from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from fastapi import HTTPException, status
from uuid import UUID
from geoalchemy2 import Geometry

from app.models import Incident, User, NeighborhoodZone, IncidentResponse
from app.schemas.incident import PanicRequest, RespondRequest
from app.db.enums import IncidentStatus, UserRole, ResponseType
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

async def get_incident_detail(db: AsyncSession, incident_id: UUID) -> Incident:
    """
    Mengambil detail insident beserta data reporter, zona dan responder
    Pkai selectinLoad untuk eager-load (hindari N+1 untuk query relationships)
    """
    stmt = (
        select(Incident)
        .where(Incident.id == incident_id)
        .options(
            selectinload(Incident.reporter),
            selectinload(Incident.rt_zone),
            selectinload(Incident.rw_zone),
            selectinload(Incident.responses).selectinload(IncidentResponse.responder),
        )
    )
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()
    
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident tidak ditemukan"
        )
    return incident

async def calculate_vote_weight(user_role: UserRole, response_type: ResponseType) -> int:
    """
    Menghitung bobot suara berdasarkan role
    Hanya untuk response_type='false_alarm' weight metter untuk voting
    Untuk 'going' dan 'witness', weight selalu 1 (kontribusi, bukan voting)
    """
    if response_type != ResponseType.FALSE_ALARM:
        return 1
    
    match user_role:
        case UserRole.RW: return 100 # Bobot final # Langsung tutup insiden
        case UserRole.RT: return 2
        case UserRole.WARGA: return 1
        case UserRole.STRANGER: return 0
        case _: return 0
        
async def create_response(
    db: AsyncSession,
    incident_id: UUID,
    responder: User,
    request: RespondRequest
) -> IncidentResponse:
    """
    Membuat response baru untuk sebuah insiden + proses logika voting (Phase 6 prep)
    """
    incident = await db.get(Incident, incident_id)
    
    # --- Validasi -----------------------------------------------------------------
    if not incident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incident tidak ditemukan"
        )
    if incident.status != IncidentStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insiden ini sudah ditutup"
        )
    if incident.reporter_id == responder.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Anda tidak dapat merespons laporan Anda sendiri"
        )
        
    # Cast string literal dari Pydantic ke Enum untuk comparison yang safe
    response_type_enum = ResponseType(request.response_type)
    
    if response_type_enum == ResponseType.FALSE_ALARM and responder.role == UserRole.STRANGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda tidak memiliki hak untuk melakukan voting"
        )
    if response_type_enum == ResponseType.GOING and not request.current_location:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lokasi wajib diisi untuk respons 'Saya ke Lokasi'"
        )
        
    # --- Calculate weight + insert ----------------------------------------------------------------
    vote_weight = await calculate_vote_weight(responder.role, response_type_enum)
    
    new_response = IncidentResponse(
        incident_id=incident_id,
        responder_id=responder.id,
        response_type=response_type_enum,
        current_location=(
            f'SRID=4326;POINT({request.current_location.lng} {request.current_location.lat})'
            if request.current_location else None
        ),
        notes=request.notes,
        vote_weight=vote_weight
    )
    
    try:
        db.add(new_response)
        await db.commit()
        await db.refresh(new_response)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Anda sudah pernah merespon insiden ini dengan tipe yang sama"
        )
        
    # --- Anti-Prank Logic (Phase 6 Prep) ------------------------------------------
    if response_type_enum == ResponseType.FALSE_ALARM:
        total_weight_stmt = select(func.sum(IncidentResponse.vote_weight)).where(
            IncidentResponse.incident_id == incident_id,
            IncidentResponse.response_type == ResponseType.FALSE_ALARM
        )
        total_weight = (await db.execute(total_weight_stmt)).scalar() or 0
        
        # Threshold 6 weight, ATAU 1 RW vote (weight=100)
        if total_weight >= 6 or vote_weight >= 100:
            incident.status = IncidentStatus.FALSE_ALARM
            incident.resolved_at = func.now()
            await db.commit()
            await db.refresh(incident)
            
    return new_response

async def get_responders_for_notification(
    db: AsyncSession,
    incident_id: UUID,
    exclude_user_id: UUID
) -> list[str]:
    """
    Ambil FCM Tokens semua partisipan insiden (reporter + responders),
    kecuali user yg baru join (jangan kirim notif ke diri sendiri)
    """
    tokens = set()
    
    # 1. Token reporter
    incident_stmt = (
        select(Incident)
        .where(Incident.id == incident_id)
        .options(selectinload(Incident.reporter))
    )
    incident = (await db.execute(incident_stmt)).scalar_one_or_none()
    if incident and incident.reporter.fcm_token and incident.reporter.id != exclude_user_id:
        tokens.add(incident.reporter.fcm_token)
        
    # 2. Token responders (selain exclude__user_id)
    responder_stmt = (
        select(User.fcm_token)
        .join(IncidentResponse, IncidentResponse.responder_id == User.id)
        .where(
            IncidentResponse.incident_id == incident_id,
            User.id != exclude_user_id,
            User.fcm_token.isnot(None)
        )
    )
    result = await db.execute(responder_stmt)
    responder_tokens = result.scalars().all()
    tokens.update(t for t in responder_tokens if t)
    
    return list