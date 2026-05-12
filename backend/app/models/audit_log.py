import uuid
from sqlalchemy import String, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String)
    entity_type: Mapped[str] = mapped_column(String)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    
    # "metadata" adalah nama atribut yang di-reserve oleh SQLAlchemy.
    # Kita rename atribut Python-nya jadi `log_metadata` tapi tetap menunjuk ke kolom `metadata` di DB.
    log_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)