# backend/app/models/invite_code.py
# Phase 8.3: Invite code untuk chain of trust RW→RT→Warga (Q6=b)
import uuid
from datetime import datetime
from sqlalchemy import String, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base, UUIDMixin, TimestampMixin
from app.db.enums import UserRole

from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .user import User
    from .zone import NeighborhoodZone


class InviteCode(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invite_codes"

    code: Mapped[str] = mapped_column(String, unique=True, index=True)
    # Role yang di-grant saat code di-redeem ('RT' atau 'WARGA'; RW di-seed manual)
    role_target: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", values_callable=lambda x: [e.value for e in x])
    )

    # Penerbit code (RW menerbitkan untuk RT, RT menerbitkan untuk Warga)
    issuer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    # Zona yang di-assign saat redeem
    zone_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("neighborhood_zones.id"))

    expires_at: Mapped[datetime | None]
    # User yang sudah pakai code ini (null = belum dipakai)
    used_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    used_at: Mapped[datetime | None]

    # ─── Relationships (Q-Invite-1 = b, full relationship) ───────────────────
    issuer: Mapped["User | None"] = relationship(
        back_populates="issued_invites", foreign_keys=[issuer_id]
    )
    used_by_user: Mapped["User | None"] = relationship(
        back_populates="redeemed_invite", foreign_keys=[used_by]
    )
    zone: Mapped["NeighborhoodZone | None"] = relationship(back_populates="invite_codes")