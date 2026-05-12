from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime
import uuid

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    """Mixin untuk menambahkan kolom created_at dan updated_at."""
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

class UUIDMixin:
    """Mixin untuk ID primary key UUID."""
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)