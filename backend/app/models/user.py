import uuid
from sqlalchemy import String, Boolean, DECIMAL, Enum as SAEnum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2.types import Geography
from app.db.base import Base, UUIDMixin, TimestampMixin
from app.db.enums import UserRole

# Forward declaration untuk NeighborhoodZone
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .zone import NeighborhoodZone

class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    firebase_uid: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[str]
    email: Mapped[str | None] = mapped_column(unique=True)
    phone: Mapped[str | None]
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role", values_callable=lambda x: [e.value for e in x]), default=UserRole.STRANGER)
    
    rw_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("neighborhood_zones.id"))
    rt_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("neighborhood_zones.id"))

    home_location: Mapped[str | None] = mapped_column(Geography(geometry_type='POINT', srid=4326))
    current_location: Mapped[str | None] = mapped_column(Geography(geometry_type='POINT', srid=4326))
    
    trust_score: Mapped[float] = mapped_column(DECIMAL(3, 2), default=0.50)
    is_verified: Mapped[bool] = mapped_column(default=False)
    fcm_token: Mapped[str | None]
    
    rt_zone: Mapped["NeighborhoodZone | None"] = relationship(foreign_keys=[rt_id], back_populates="warga_rt")
    rw_zone: Mapped["NeighborhoodZone | None"] = relationship(foreign_keys=[rw_id], back_populates="warga_rw")
    
    ketua_zone: Mapped["NeighborhoodZone | None"] = relationship(back_populates="ketua", foreign_keys="NeighborhoodZone.ketua_id")