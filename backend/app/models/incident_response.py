# backend/app/models/incident_response.py
import uuid
from datetime import datetime
from sqlalchemy import Integer, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2.types import Geography
from app.db.base import Base, UUIDMixin, TimestampMixin
from app.db.enums import ResponseType
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.incident import Incident
    from app.models.user import User


class IncidentResponse(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "incident_responses"

    incident_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    responder_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    # CRITICAL: values_callable WAJIB ditambahkan untuk serialize lowercase ke DB.
    # Tanpa ini, SQLAlchemy serialize pakai enum NAME (GOING) bukan VALUE (going),
    # yang akan kena reject CHECK constraint di Postgres.
    response_type: Mapped[ResponseType] = mapped_column(
        SAEnum(
            ResponseType,
            name="response_type_check",
            native_enum=False,
            length=20,
            values_callable=lambda x: [e.value for e in x],
        )
    )

    vote_weight: Mapped[int] = mapped_column(Integer, default=1)
    current_location: Mapped[str | None] = mapped_column(Geography(geometry_type='POINT', srid=4326))
    notes: Mapped[str | None]

    # Relationships (jangan dihapus, dibutuhkan oleh selectinload di service)
    incident: Mapped["Incident"] = relationship(back_populates="responses")
    responder: Mapped["User"] = relationship(back_populates="responses")