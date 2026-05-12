from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from app.db.enums import UserRole

class Location(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lng: float = Field(..., ge=-180, le=180, description="Longitude")

class OnboardingRequest(BaseModel):
    home_location: Location

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