from pydantic import BaseModel, HttpUrl, Field, ConfigDict
from uuid import UUID
from datetime import datetime
from typing import List, Literal, Optional, Dict

# FIX: Impor skema Location yang sudah ada, jangan didefinisikan ulang.
from app.schemas.user import Location

# Skema yang sudah ada (tidak diubah)
class PanicRequest(BaseModel):
    location: Location
    audio_url: HttpUrl
    audio_duration_sec: int = 10

# --- Skema Baru untuk Phase 4.2 ---

class ResponderInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: UUID
    full_name: str
    role: str
    response_type: str
    current_location: Optional[Location] = None
    vote_weight: int
    # FIX: Hapus alias, akan di-mapping manual di route untuk kejelasan.
    joined_at: datetime

class ReporterInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    role: str
    is_stranger: bool

class IncidentDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: str
    location: Location
    audio_url: Optional[str] = None
    audio_duration_sec: int
    ai_summary: Optional[str] = None
    human_address: Optional[str] = None
    ai_classification: Optional[Dict] = None
    reporter: ReporterInfo
    responders: List[ResponderInfo]
    rt_zone_number: Optional[str] = None
    rw_zone_number: Optional[str] = None
    created_at: datetime
    total_vote_weight_false_alarm: int

class RespondRequest(BaseModel):
    response_type: Literal['going', 'false_alarm', 'witness']
    current_location: Optional[Location] = None
    notes: Optional[str] = None

class RespondResponse(BaseModel):
    message: str
    response_id: UUID
    vote_weight: int
    is_final: bool
    incident_status: str

# FIX: Tidak perlu model_rebuild() karena tidak ada lagi forward reference string.