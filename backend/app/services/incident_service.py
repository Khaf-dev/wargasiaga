from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from uuid import UUID
from geoalchemy2 import Geometry

from app.models import Incident, User, NeighborhoodZone
from app.schemas.incident import PanicRequest
from app.db.enums import IncidentStatus, UserRole
from typing import List, Tuple

async def create_incident(db: AsyncSession, reporter_id: UUID, request: PanicRequest) -> Incident:
    reporter = await db.get(User, reporter_id)
    if not reporter:
        raise Exception("Reporter tidak ditemukan")

    point_wkt = f'SRID=4326;POINT({request.location.lng} {request.location.lat})'
    point_geom = func.ST_GeogFromText(point_wkt).cast(Geometry)
    
    stmt_zone = select(NeighborhoodZone).where(
        (NeighborhoodZone.zone_type == 'RT') &
        (func.ST_Within(point_geom, NeighborhoodZone.area.cast(Geometry)))
    )
    result_zone = await db.execute(stmt_zone)
    rt_zone = result_zone.scalar_one_or_none()
    
    rt_id = rt_zone.id if rt_zone else None
    rw_id = rt_zone.parent_id if rt_zone else None

    new_incident = Incident(
        reporter_id=reporter_id,
        location=point_wkt,
        audio_url=str(request.audio_url),
        audio_duration_sec=request.audio_duration_sec,
        status=IncidentStatus.ACTIVE,
        is_reporter_stranger=(reporter.role == UserRole.STRANGER),
        rt_id=rt_id,
        rw_id=rw_id
    )
    
    db.add(new_incident)
    await db.commit()
    await db.refresh(new_incident)
    
    # ❌ FIX: new_incident.reporter = reporter dihapus untuk mencegah error
    return new_incident


async def get_target_fcm_tokens(db: AsyncSession, incident: Incident) -> Tuple[List[str], List[dict]]:
    target_tokens = set()
    target_info =[]

    # 1. AMBIL PETUGAS RT/RW
    if incident.rt_id or incident.rw_id:
        stmt_officials = select(User).where(
            User.fcm_token.isnot(None),
            User.role.in_([UserRole.RT, UserRole.RW]),
            or_(User.rt_id == incident.rt_id, User.rw_id == incident.rw_id)
        )
        officials = (await db.execute(stmt_officials)).scalars().all()
        for off in officials:
            target_tokens.add(off.fcm_token)
            target_info.append({"id": str(off.id), "role": off.role.value, "distance": 0})

    # 2. CARI TETANGGA (Radius 2000m, max 10)
    # ✅ FIX: incident.location sudah berupa WKBElement dari GeoAlchemy2
    # Kita bisa langsung cast ke Geometry tanpa ST_GeogFromText
    incident_geom = func.ST_GeogFromText(
        func.ST_AsText(incident.location)
    ).cast(Geometry)
    
    stmt_neighbors = select(
        User, 
        func.ST_Distance(User.home_location.cast(Geometry), incident_geom).label("distance")
    ).where(
        User.id != incident.reporter_id,
        User.fcm_token.isnot(None),
        func.ST_DWithin(User.home_location.cast(Geometry), incident_geom, 2000)
    ).order_by("distance").limit(10)
    
    neighbors_result = await db.execute(stmt_neighbors)
    for neighbor, distance in neighbors_result.all():
        if neighbor.fcm_token not in target_tokens:
            target_tokens.add(neighbor.fcm_token)
            target_info.append({
                "id": str(neighbor.id), 
                "role": neighbor.role.value, 
                "distance": round(distance)
            })

    return list(target_tokens), target_info