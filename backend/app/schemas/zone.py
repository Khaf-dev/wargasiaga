# backend/app/schemas/zone.py
# Phase 8.5: Schema untuk pendaftaran wilayah RT/RW via map picker
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID


class ZoneGeometryRequest(BaseModel):
    """Request set geometry zona: ketua klik titik kediaman di map.
    Radius TIDAK dikirim — auto by role (RT 500m / RW 1500m) di backend."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude titik kediaman ketua")
    lng: float = Field(..., ge=-180, le=180, description="Longitude titik kediaman ketua")


class ZoneResponse(BaseModel):
    """Response detail zona yang dikelola."""
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    zone_type: str
    zone_number: str
    radius_meters: int | None = None
    parent_id: UUID | None = None
    city: str
    province: str
    # center dikirim sebagai lat/lng (di-extract dari geography di service)
    center_lat: float | None = None
    center_lng: float | None = None
    has_geometry: bool = False  # true kalau center + area sudah di-set


class ZoneUpdateResponse(BaseModel):
    zone: ZoneResponse
    message: str


# ─── Phase 8.6: Dashboard role-based ─────────────────────────────────────────
class ZoneMemberResponse(BaseModel):
    """Data warga untuk daftar (RT/RW view). Field sensitif (NIK/trust) DIKECUALIKAN
    demi privacy (Q-Dash-C). Hanya info berguna untuk koordinasi RT/RW."""
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    full_name: str
    role: str
    is_verified: bool
    address_block: str | None = None
    rt_number: str | None = None
    rw_number: str | None = None
    phone: str | None = None
    data_completed: bool = False


class ChildRTResponse(BaseModel):
    """Data RT anak (untuk RW melihat daftar RT di wilayahnya)."""
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    zone_type: str
    zone_number: str
    radius_meters: int | None = None
    has_geometry: bool = False
    member_count: int = 0  # jumlah warga di RT ini


class ZoneOverviewResponse(BaseModel):
    """Ringkasan zona yang dikelola (Daftar RW = overview RW sendiri, Q-Dash-A=b)."""
    zone_id: UUID
    zone_type: str
    zone_number: str
    city: str
    province: str
    has_geometry: bool
    radius_meters: int | None = None
    total_members: int      # total warga di zona
    total_child_rts: int    # jumlah RT (0 kalau zona RT)
    verified_members: int   # warga terverifikasi


class MembersListResponse(BaseModel):
    members: list[ZoneMemberResponse]
    total: int