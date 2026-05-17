from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

# Path ke direktori 'backend/'
BACKEND_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    # Membaca file .env dari root monorepo (satu level di atas BACKEND_DIR)
    model_config = SettingsConfigDict(env_file=BACKEND_DIR.parent / ".env", env_file_encoding='utf-8', extra='ignore')

    # App Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # Supabase DB Connection
    DATABASE_URL: str
    
    # Firebase Admin SDK
    GOOGLE_APPLICATION_CREDENTIALS: str

    # Gemini API Key
    GEMINI_API_KEY: str
    
    # Google Maps Geocoding API Key
    GOOGLE_GEOCODING_API_KEY: str

    # CORS Origin
    CORS_ORIGIN: str

settings = Settings()