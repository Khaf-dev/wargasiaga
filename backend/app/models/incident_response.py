import uuid
from sqlalchemy import String, Integer, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2.types import Geography
from app.db.base import Base, UUIDMixin, TimestampMixin
from app.db.enums import ResponseType

class IncidentResponse(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "incident_responses"
    
    incident_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidents.id", ondelete="CASCADE"))
    responder_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    
    # Gunakan native_enum=False untuk membuat CHECK constraint, bukan tipe ENUM native di DB.
    response_type: Mapped[ResponseType] = mapped_column(SAEnum(ResponseType, name="response_type_check", native_enum=False, length=20))
    
    vote_weight: Mapped[int] = mapped_column(default=1)
    current_location: Mapped[str | None] = mapped_column(Geography(geometry_type='POINT', srid=4326))
    notes: Mapped[str | None]