from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload
from uuid import UUID
from geoalchemy2 import Geometry

from app.models import User, NeighborhoodZone
from app.api.auth import FirebaseUser
from app.schemas.user import Location
from app.db.enums import UserRole

async def get_or_create_user(db: AsyncSession, firebase_user: FirebaseUser) -> User:
    stmt = select(User).where(User.firebase_uid == firebase_user.uid)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            firebase_uid=firebase_user.uid,
            full_name=firebase_user.name or "Pengguna Baru",
            email=firebase_user.email,
            role=UserRole.STRANGER # Menggunakan Enum
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user

async def onboard_user(db: AsyncSession, user_id: UUID, home_location: Location) -> User:
    point_wkt = f'SRID=4326;POINT({home_location.lng} {home_location.lat})'
    
    # Cast ke Geometry untuk ST_Within
    point_geom = func.ST_GeogFromText(point_wkt).cast(Geometry)
    
    stmt_rt = select(NeighborhoodZone).where(
        (NeighborhoodZone.zone_type == 'RT') &
        (func.ST_Within(point_geom, NeighborhoodZone.area.cast(Geometry)))
    ).options(selectinload(NeighborhoodZone.parent))
    
    result_rt = await db.execute(stmt_rt)
    rt_zone = result_rt.scalar_one_or_none()

    update_values = {"home_location": point_wkt}

    if rt_zone and rt_zone.parent:
        update_values.update({
            "is_verified": True,
            "role": UserRole.WARGA, # Menggunakan Enum
            "trust_score": 0.50,
            "rt_id": rt_zone.id,
            "rw_id": rt_zone.parent.id
        })
    else:
        update_values.update({
            "is_verified": False,
            "role": UserRole.STRANGER, # Menggunakan Enum
            "trust_score": 0.20,
            "rt_id": None,
            "rw_id": None
        })

    update_stmt = update(User).where(User.id == user_id).values(**update_values)
    await db.execute(update_stmt)
    await db.commit()
    
    # RE-QUERY untuk mendapatkan data terbaru dengan eager-loaded relationships
    # Ini untuk menghindari error "MissingGreenlet" dari lazy loading di async.
    final_query = (
        select(User)
        .options(selectinload(User.rt_zone), selectinload(User.rw_zone))
        .where(User.id == user_id)
    )
    final_result = await db.execute(final_query)
    return final_result.scalar_one()