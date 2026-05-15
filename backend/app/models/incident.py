import uuid
from typing import List
# FIX: Tambahkan import datetime
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2.types import Geography
from app.db.base import Base, UUIDMixin, TimestampMixin
from app.db.enums import IncidentStatus

# Forward declaration untuk type hinting
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .user import User
    from .zone import NeighborhoodZone
    from .incident_response import IncidentResponse

class Incident(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "incidents"

    reporter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    location: Mapped[str] = mapped_column(Geography(geometry_type='POINT', srid=4326))
    audio_url: Mapped[str | None]
    audio_duration_sec: Mapped[int | None] = mapped_column(default=10)
    ai_classification: Mapped[dict | None] = mapped_column(JSONB)
    ai_summary: Mapped[str | None]
    human_address: Mapped[str | None]
    status: Mapped[IncidentStatus] = mapped_column(SAEnum(IncidentStatus, name="incident_status"), default=IncidentStatus.ACTIVE)
    rw_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("neighborhood_zones.id"))
    rt_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("neighborhood_zones.id"))
    is_reporter_stranger: Mapped[bool] = mapped_column(default=False)
    resolved_at: Mapped[datetime | None]

    # --- Tambahan Relationship untuk Phase 4.2 ---
    reporter: Mapped["User"] = relationship(foreign_keys=[reporter_id], back_populates="incidents")
    rt_zone: Mapped["NeighborhoodZone"] = relationship(foreign_keys=[rt_id])
    rw_zone: Mapped["NeighborhoodZone"] = relationship(foreign_keys=[rw_id])
    responses: Mapped[List["IncidentResponse"]] = relationship(back_populates="incident", cascade="all, delete-orphan")