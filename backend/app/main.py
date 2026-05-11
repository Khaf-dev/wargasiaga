from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.firebase import initialize_firebase_app

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code to run on startup
    print("Starting up...")
    initialize_firebase_app()
    yield
    # Code to run on shutdown
    print("Shutting down...")

app = FastAPI(lifespan=lifespan, title="WargaSiaga API")

# Setup CORS
if settings.CORS_ORIGIN:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.CORS_ORIGIN],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/health", tags=["Utilities"])
async def health_check():
    """Endpoint untuk cek status API."""
    return {"status": "ok", "environment": settings.ENVIRONMENT}

# TODO: Nanti kita include router dari api/ di sini
# from app.api import users, incidents
# app.include_router(users.router, prefix="/api/v1")
# app.include_router(incidents.router, prefix="/api/v1")