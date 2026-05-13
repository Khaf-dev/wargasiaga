from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.firebase import initialize_firebase_app
from app.api import users as users_api
from app.api import incidents as incidents_api

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting up...")
    print(f"CORS allowed origins: {settings.CORS_ORIGIN}")  # ← log untuk debug
    initialize_firebase_app()
    yield
    print("Shutting down...")

app = FastAPI(lifespan=lifespan, title="WargaSiaga API")

# CORS: split by comma kalau ada multiple origins
allowed_origins = [origin.strip() for origin in settings.CORS_ORIGIN.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", tags=["Utilities"])
async def health_check():
    return {"status": "ok", "environment": settings.ENVIRONMENT}

app.include_router(users_api.router, prefix="/api/v1")
app.include_router(incidents_api.router, prefix="/api/v1")