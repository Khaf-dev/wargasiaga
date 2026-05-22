import uuid
from typing import List
from sqlalchemy import String, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2.types import Geography
from app.db.base import Base, UUIDMixin, TimestampMixin

# Forward declaration untuk User
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .user import User
    from .invite_code import InviteCode

class NeighborhoodZone(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "neighborhood_zones"

    zone_type: Mapped[str]
    zone_number: Mapped[str]
    
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("neighborhood_zones.id"))
    ketua_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    
    area: Mapped[str] = mapped_column(Geography(geometry_type='POLYGON', srid=4326))
    center: Mapped[str | None] = mapped_column(Geography(geometry_type='POINT', srid=4326))

    # Phase 8.3: radius zona (500m RT / 1500m RW) — area POLYGON di-generate dari center+radius (Phase 8.5)
    radius_meters: Mapped[int | None] = mapped_column(Integer)
    
    city: Mapped[str]
    province: Mapped[str]
    
    parent: Mapped["NeighborhoodZone | None"] = relationship(back_populates="children", remote_side="NeighborhoodZone.id")
    children: Mapped[List["NeighborhoodZone"]] = relationship(back_populates="parent")
    
    ketua: Mapped["User | None"] = relationship(back_populates="ketua_zone", foreign_keys=[ketua_id])
    
    warga_rt: Mapped[List["User"]] = relationship(back_populates="rt_zone", foreign_keys="User.rt_id")
    warga_rw: Mapped[List["User"]] = relationship(back_populates="rw_zone", foreign_keys="User.rw_id")

    # Phase 8.3: invite codes yang terkait dengan zona ini
    invite_codes: Mapped[List["InviteCode"]] = relationship(back_populates="zone")