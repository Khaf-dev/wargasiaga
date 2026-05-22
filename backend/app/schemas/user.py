from pydantic import BaseModel, Field, ConfigDict, field_validator, computed_field
from uuid import UUID
from datetime import date
from app.db.enums import UserRole, Gender

class Location(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")

class OnboardingRequest(BaseModel):
    home_location: Location

class FCMTokenUpdate(BaseModel):
    fcm_token: str | None = Field(None, description="Token FCM perangkat user")

class UserBase(BaseModel):
    full_name: str
    email: str | None = None
    role: UserRole

class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    firebase_uid: str
    is_verified: bool
    trust_score: float
    rt_id: UUID | None = None
    rw_id: UUID | None = None

class OnboardingResponse(BaseModel):
    user: UserResponse
    message: str


# ─── Phase 8.4: Pendataan Data Diri WARGA ────────────────────────────────────
class DataDiriRequest(BaseModel):
    """Request pendataan data diri. Optional untuk diisi, tapi kalau diisi
    harus lengkap semua (Q-Data-2=a all-or-nothing)."""
    nik: str = Field(..., description="NIK 16 digit")
    birth_place: str = Field(..., min_length=1, description="Tempat lahir")
    birth_date: date = Field(..., description="Tanggal lahir")
    gender: Gender = Field(..., description="Jenis kelamin (L/P)")
    address_block: str = Field(..., min_length=1, description="Alamat rumah / blok")
    rt_number: str = Field(..., min_length=1, description="Nomor RT (input manual)")
    rw_number: str = Field(..., min_length=1, description="Nomor RW (input manual)")
    kelurahan: str = Field(..., min_length=1)
    kecamatan: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=8, description="Nomor telepon")

    @field_validator("nik")
    @classmethod
    def validate_nik(cls, v: str) -> str:
        # Q-Data-1 (a): cek 16 digit angka saja
        cleaned = v.strip()
        if not cleaned.isdigit():
            raise ValueError("NIK harus berupa angka")
        if len(cleaned) != 16:
            raise ValueError("NIK harus tepat 16 digit")
        return cleaned

    @field_validator("birth_date")
    @classmethod
    def validate_birth_date(cls, v: date) -> date:
        today = date.today()
        if v > today:
            raise ValueError("Tanggal lahir tidak boleh di masa depan")
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if age > 120:
            raise ValueError("Tanggal lahir tidak valid")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = v.strip().replace(" ", "").replace("-", "")
        if not cleaned.lstrip("+").isdigit():
            raise ValueError("Nomor telepon tidak valid")
        return cleaned


class DataDiriResponse(BaseModel):
    """Response data diri dengan usia computed dari birth_date (Q-Data-2=a)."""
    model_config = ConfigDict(from_attributes=True)
    nik: str | None = None
    birth_place: str | None = None
    birth_date: date | None = None
    gender: Gender | None = None
    address_block: str | None = None
    rt_number: str | None = None
    rw_number: str | None = None
    kelurahan: str | None = None
    kecamatan: str | None = None
    phone: str | None = None
    data_completed: bool = False

    @computed_field
    @property
    def usia(self) -> int | None:
        # Usia dihitung on-the-fly dari birth_date, tidak disimpan (Q-Data-2=a, anti-basi)
        if self.birth_date is None:
            return None
        today = date.today()
        return today.year - self.birth_date.year - (
            (today.month, today.day) < (self.birth_date.month, self.birth_date.day)
        )


class DataDiriUpdateResponse(BaseModel):
    data: DataDiriResponse
    message: str