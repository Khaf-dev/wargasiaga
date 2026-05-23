# backend/app/api/zones.py
# Phase 8.5: Endpoint pendaftaran wilayah RT/RW via map picker.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from geoalchemy2 import Geometry

from app.db.session import get_db
from app.api.auth import get_current_user, FirebaseUser
from app.services import user_service, zone_service
from app.schemas import zone as zone_schema
from app.models import NeighborhoodZone

router = APIRouter(prefix="/zones", tags=["Zones"])


async def _zone_to_response(db: AsyncSession, zone: NeighborhoodZone) -> dict:
    """Convert zona → response dict. Extract center geography jadi lat/lng
    pakai ST_Y/ST_X (verified clean di DB)."""
    center_lat = None
    center_lng = None
    has_geometry = False

    if zone.center is not None:
        # ST_Y = latitude, ST_X = longitude (center di-cast ke geometry dulu)
        coords_stmt = select(
            func.ST_Y(NeighborhoodZone.center.cast(Geometry)),
            func.ST_X(NeighborhoodZone.center.cast(Geometry)),
        ).where(NeighborhoodZone.id == zone.id)
        row = (await db.execute(coords_stmt)).one()
        center_lat = float(row[0])
        center_lng = float(row[1])
        has_geometry = zone.area is not None

    return {
        "id": zone.id,
        "zone_type": zone.zone_type,
        "zone_number": zone.zone_number,
        "radius_meters": zone.radius_meters,
        "parent_id": zone.parent_id,
        "city": zone.city,
        "province": zone.province,
        "center_lat": center_lat,
        "center_lng": center_lng,
        "has_geometry": has_geometry,
    }


@router.get("/me", response_model=zone_schema.ZoneResponse)
async def get_my_zone(
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user),
):
    """Ambil zona yang dikelola ketua (untuk prefill map picker)."""
    user = await user_service.get_or_create_user(db, firebase_user)
    try:
        zone = await zone_service.get_my_zone(db, user)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return await _zone_to_response(db, zone)


@router.patch("/me/geometry", response_model=zone_schema.ZoneUpdateResponse)
async def update_my_zone_geometry(
    payload: zone_schema.ZoneGeometryRequest,
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user),
):
    """
    Set wilayah zona: ketua klik titik kediaman di map.
    Radius auto by role (RT 500m / RW 1500m). RT divalidasi harus dalam RW induk.
    """
    user = await user_service.get_or_create_user(db, firebase_user)
    try:
        zone = await zone_service.update_zone_geometry(db, user, payload.lat, payload.lng)
    except ValueError as e:
        # Validasi gagal: bukan ketua / RT di luar RW / RW belum daftar
        raise HTTPException(status_code=400, detail=str(e))
    zone_resp = await _zone_to_response(db, zone)
    return {
        "zone": zone_resp,
        "message": (
            f"Wilayah {zone.zone_type} {zone.zone_number} berhasil didaftarkan! "
            f"Radius {zone.radius_meters}m dari titik kediaman."
        ),
    }


# ─── Phase 8.6: Dashboard role-based endpoints ───────────────────────────────
@router.get("/me/members", response_model=zone_schema.MembersListResponse)
async def get_my_zone_members(
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user),
):
    """Daftar warga di zona yang dikelola (RT/RW only). Field sensitif dikecualikan."""
    user = await user_service.get_or_create_user(db, firebase_user)
    try:
        members = await zone_service.get_zone_members(db, user)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return {"members": members, "total": len(members)}


@router.get("/me/children", response_model=list[zone_schema.ChildRTResponse])
async def get_my_child_rts(
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user),
):
    """Daftar RT di bawah RW (RW only)."""
    user = await user_service.get_or_create_user(db, firebase_user)
    try:
        rts = await zone_service.get_child_rts(db, user)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return rts


@router.get("/me/overview", response_model=zone_schema.ZoneOverviewResponse)
async def get_my_zone_overview(
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user),
):
    """Ringkasan zona yang dikelola (overview RT/RW sendiri)."""
    user = await user_service.get_or_create_user(db, firebase_user)
    try:
        overview = await zone_service.get_zone_overview(db, user)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return overview