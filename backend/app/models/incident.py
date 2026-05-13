import uuid
from sqlalchemy import String, Integer, Boolean, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, UUIDMixin, TimestampMixin
from app.db.enums import IncidentStatus
from geoalchemy2 import Geography

class Incident(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "incidents"

    reporter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    location: Mapped[str] = mapped_column(Geography(geometry_type='POINT', srid=4326))
    audio_url: Mapped[str | None]
    audio_duration_sec: Mapped[int | None] = mapped_column(default=10)
    ai_classification: Mapped[dict | None] = mapped_column(JSONB)
    ai_summary: Mapped[str | None]
    human_address: Mapped[str | None]
    status: Mapped[IncidentStatus] = mapped_column(SAEnum(IncidentStatus, name="incident_status", native_enum=False), default=IncidentStatus.ACTIVE)
    rw_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("neighborhood_zones.id"))
    rt_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("neighborhood_zones.id"))
    is_reporter_stranger: Mapped[bool] = mapped_column(default=False)