import uuid
from datetime import date
from typing import List
from sqlalchemy import String, Boolean, DECIMAL, Enum as SAEnum, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2.types import Geography
from app.db.base import Base, UUIDMixin, TimestampMixin
from app.db.enums import UserRole, Gender

# Forward declaration untuk type hinting
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .zone import NeighborhoodZone
    from .incident import Incident
    from .incident_response import IncidentResponse
    from .invite_code import InviteCode


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    firebase_uid: Mapped[str] = mapped_column(String, unique=True, index=True)
    full_name: Mapped[str]
    email: Mapped[str | None] = mapped_column(unique=True)
    phone: Mapped[str | None]
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="user_role", values_callable=lambda x: [e.value for e in x]),
        default=UserRole.STRANGER
    )
    
    rw_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("neighborhood_zones.id"))
    rt_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("neighborhood_zones.id"))

    home_location: Mapped[str | None] = mapped_column(Geography(geometry_type='POINT', srid=4326))
    current_location: Mapped[str | None] = mapped_column(Geography(geometry_type='POINT', srid=4326))
    
    trust_score: Mapped[float] = mapped_column(DECIMAL(3, 2), default=0.50)
    is_verified: Mapped[bool] = mapped_column(default=False)
    fcm_token: Mapped[str | None]

    # ─── Phase 8.3: Pendataan Data Diri WARGA (semua optional) ───────────────
    nik: Mapped[str | None] = mapped_column(String, unique=True)  # 16 digit, unique (partial index di DB)
    birth_place: Mapped[str | None]
    birth_date: Mapped[date | None] = mapped_column(Date)  # usia di-compute dari sini, tidak disimpan
    gender: Mapped[Gender | None] = mapped_column(
        SAEnum(Gender, name="gender_type", values_callable=lambda x: [e.value for e in x])
    )
    address_block: Mapped[str | None]  # alamat rumah / blok
    kelurahan: Mapped[str | None]
    kecamatan: Mapped[str | None]
    data_completed: Mapped[bool] = mapped_column(Boolean, default=False)  # penanda kelengkapan data
    
    # ─── Existing relationships ──────────────────────────────────────────
    rt_zone: Mapped["NeighborhoodZone | None"] = relationship(
        foreign_keys=[rt_id], back_populates="warga_rt"
    )
    rw_zone: Mapped["NeighborhoodZone | None"] = relationship(
        foreign_keys=[rw_id], back_populates="warga_rw"
    )
    ketua_zone: Mapped["NeighborhoodZone | None"] = relationship(
        back_populates="ketua", foreign_keys="NeighborhoodZone.ketua_id"
    )
    
    # ─── Phase 4.2 relationships ─────────────────────────────────────────
    # User sebagai reporter (korban) di Incident
    incidents: Mapped[List["Incident"]] = relationship(
        back_populates="reporter",
        foreign_keys="Incident.reporter_id"
    )
    # User sebagai responder (tetangga yang join) di IncidentResponse
    responses: Mapped[List["IncidentResponse"]] = relationship(
        back_populates="responder"
    )

    # ─── Phase 8.3: Invite code (chain of trust RW→RT→Warga) ─────────────────
    # User sebagai penerbit invite code (RW issue ke RT, RT issue ke Warga)
    issued_invites: Mapped[List["InviteCode"]] = relationship(
        back_populates="issuer", foreign_keys="InviteCode.issuer_id"
    )
    # Invite code yang sudah dipakai user ini untuk redeem (1 user 1 redeem)
    redeemed_invite: Mapped["InviteCode | None"] = relationship(
        back_populates="used_by_user", foreign_keys="InviteCode.used_by"
    )