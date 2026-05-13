from pydantic import BaseModel, HttpUrl
from .user import Location

class PanicRequest(BaseModel):
    location: Location
    audio_url: HttpUrl
    audio_duration_sec: int = 10