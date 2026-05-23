# backend/app/services/zone_service.py
# Phase 8.5: Service pendaftaran wilayah RT/RW (geofencing via map picker).
# Ketua klik titik kediaman → generate area circle (ST_Buffer) + radius by role.
# RT WAJIB di dalam radius RW induk (ST_DWithin validation).
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from uuid import UUID

from app.models import User, NeighborhoodZone
from app.db.enums import UserRole

# Radius fixed by role (Q-Service-1=a). Sesuai decision: RT 500m, RW 1.5km.
RADIUS_BY_ROLE = {
    UserRole.RW: 1500,
    UserRole.RT: 500,
}


def get_radius_for_role(role: UserRole) -> int:
    """Radius zona berdasarkan role. Hanya RT/RW yang boleh daftar wilayah."""
    radius = RADIUS_BY_ROLE.get(role)
    if radius is None:
        raise ValueError("Hanya Ketua RT atau RW yang bisa mendaftarkan wilayah.")
    return radius


def _managed_zone_id(user: User) -> UUID:
    """Tentukan zona yang dikelola user (ketua_id NULL di DB, pakai arah user->zona)."""
    if user.role == UserRole.RW:
        if not user.rw_id:
            raise ValueError("Akun RW ini belum terhubung ke zona RW manapun.")
        return user.rw_id
    if user.role == UserRole.RT:
        if not user.rt_id:
            raise ValueError("Akun RT ini belum terhubung ke zona RT manapun.")
        return user.rt_id
    raise ValueError("Hanya Ketua RT atau RW yang bisa mendaftarkan wilayah.")


async def get_my_zone(db: AsyncSession, user: User) -> NeighborhoodZone:
    """Ambil zona yang dikelola user (untuk prefill map picker)."""
    zone_id = _managed_zone_id(user)
    stmt = select(NeighborhoodZone).where(NeighborhoodZone.id == zone_id)
    result = await db.execute(stmt)
    zone = result.scalar_one_or_none()
    if not zone:
        raise ValueError("Zona tidak ditemukan.")
    return zone


async def update_zone_geometry(
    db: AsyncSession, user: User, lat: float, lng: float
) -> NeighborhoodZone:
    """
    Set center + radius + area zona berdasarkan titik klik ketua.
    - Radius auto by role (RT 500m / RW 1500m).
    - RT: validasi center harus DALAM radius RW induk (ST_DWithin).
    - area di-generate via ST_Buffer(center, radius) → POLYGON geography.
    """
    radius = get_radius_for_role(user.role)
    zone_id = _managed_zone_id(user)
    point_wkt = f"SRID=4326;POINT({lng} {lat})"

    # ─── Validasi RT harus di dalam wilayah RW induk ─────────────────────────
    if user.role == UserRole.RT:
        # Ambil zona RT untuk tau parent (RW) nya
        rt_zone_stmt = select(NeighborhoodZone).where(NeighborhoodZone.id == zone_id)
        rt_zone = (await db.execute(rt_zone_stmt)).scalar_one_or_none()
        if not rt_zone or not rt_zone.parent_id:
            raise ValueError("Zona RT ini belum terhubung ke RW induk.")

        # Ambil center RW induk
        rw_stmt = select(NeighborhoodZone.center).where(
            NeighborhoodZone.id == rt_zone.parent_id
        )
        rw_center = (await db.execute(rw_stmt)).scalar_one_or_none()
        if rw_center is None:
            raise ValueError(
                "RW induk belum menetapkan wilayahnya. Minta Ketua RW mendaftar dulu."
            )

        # Cek titik RT dalam radius RW (1500m)
        rw_radius = RADIUS_BY_ROLE[UserRole.RW]
        check_stmt = select(
            func.ST_DWithin(
                func.ST_GeogFromText(point_wkt),
                rw_center,  # sudah geography dari kolom center
                rw_radius,
            )
        )
        is_within = (await db.execute(check_stmt)).scalar_one()
        if not is_within:
            raise ValueError(
                "Titik kediaman RT harus berada di dalam wilayah RW induk. "
                "Pilih titik yang lebih dekat dengan pusat RW."
            )

    # ─── Generate area (ST_Buffer) + set center + radius ─────────────────────
    # ST_Buffer(geography, meter) → geography POLYGON (verified di DB: 33-point polygon)
    area_expr = func.ST_Buffer(func.ST_GeogFromText(point_wkt), radius)

    update_stmt = (
        update(NeighborhoodZone)
        .where(NeighborhoodZone.id == zone_id)
        .values(
            center=point_wkt,
            radius_meters=radius,
            area=area_expr,
        )
    )
    await db.execute(update_stmt)
    await db.commit()

    # Re-query untuk dapat data terbaru (hindari MissingGreenlet, pattern onboard_user)
    final_stmt = select(NeighborhoodZone).where(NeighborhoodZone.id == zone_id)
    return (await db.execute(final_stmt)).scalar_one()


# ─── Phase 8.6: Dashboard role-based queries ─────────────────────────────────
async def get_zone_members(db: AsyncSession, user: User) -> list[User]:
    """
    Daftar warga di zona yang dikelola (Q-Dash-B access matrix).
    RT → warga di rt_id-nya. RW → warga di rw_id-nya.
    Hanya RT/RW yang boleh akses.
    """
    if user.role == UserRole.RW:
        if not user.rw_id:
            raise ValueError("Akun RW ini belum terhubung ke zona RW.")
        stmt = select(User).where(User.rw_id == user.rw_id).order_by(User.full_name)
    elif user.role == UserRole.RT:
        if not user.rt_id:
            raise ValueError("Akun RT ini belum terhubung ke zona RT.")
        stmt = select(User).where(User.rt_id == user.rt_id).order_by(User.full_name)
    else:
        raise ValueError("Hanya Ketua RT atau RW yang bisa melihat daftar warga.")

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_child_rts(db: AsyncSession, user: User) -> list[dict]:
    """
    Daftar RT di bawah RW (hanya untuk role RW).
    Tiap RT plus jumlah warganya.
    """
    if user.role != UserRole.RW:
        raise ValueError("Hanya Ketua RW yang bisa melihat daftar RT.")
    if not user.rw_id:
        raise ValueError("Akun RW ini belum terhubung ke zona RW.")

    # Ambil RT anak (parent_id == rw zona, zone_type RT)
    stmt = (
        select(NeighborhoodZone)
        .where(
            (NeighborhoodZone.parent_id == user.rw_id)
            & (NeighborhoodZone.zone_type == "RT")
        )
        .order_by(NeighborhoodZone.zone_number)
    )
    rts = list((await db.execute(stmt)).scalars().all())

    # Hitung jumlah warga tiap RT
    result = []
    for rt in rts:
        count_stmt = select(func.count(User.id)).where(User.rt_id == rt.id)
        member_count = (await db.execute(count_stmt)).scalar_one()
        result.append({
            "id": rt.id,
            "zone_type": rt.zone_type,
            "zone_number": rt.zone_number,
            "radius_meters": rt.radius_meters,
            "has_geometry": rt.area is not None and rt.center is not None,
            "member_count": member_count,
        })
    return result


async def get_zone_overview(db: AsyncSession, user: User) -> dict:
    """
    Ringkasan zona yang dikelola (Q-Dash-A=b: overview RW/RT sendiri).
    Total warga, RT anak, warga terverifikasi.
    """
    zone = await get_my_zone(db, user)  # reuse, sudah handle role validation

    # Filter warga by zona (RW → rw_id, RT → rt_id)
    if user.role == UserRole.RW:
        member_filter = User.rw_id == user.rw_id
    else:  # RT (get_my_zone sudah reject selain RT/RW)
        member_filter = User.rt_id == user.rt_id

    total_members = (await db.execute(
        select(func.count(User.id)).where(member_filter)
    )).scalar_one()

    verified_members = (await db.execute(
        select(func.count(User.id)).where(member_filter & (User.is_verified == True))
    )).scalar_one()

    # Jumlah RT anak (cuma relevan untuk RW)
    total_child_rts = 0
    if user.role == UserRole.RW:
        total_child_rts = (await db.execute(
            select(func.count(NeighborhoodZone.id)).where(
                (NeighborhoodZone.parent_id == user.rw_id)
                & (NeighborhoodZone.zone_type == "RT")
            )
        )).scalar_one()

    return {
        "zone_id": zone.id,
        "zone_type": zone.zone_type,
        "zone_number": zone.zone_number,
        "city": zone.city,
        "province": zone.province,
        "has_geometry": zone.area is not None and zone.center is not None,
        "radius_meters": zone.radius_meters,
        "total_members": total_members,
        "total_child_rts": total_child_rts,
        "verified_members": verified_members,
    }