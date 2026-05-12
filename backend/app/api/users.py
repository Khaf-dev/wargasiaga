from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.auth import get_current_user, FirebaseUser
from app.services import user_service
from app.schemas import user as user_schema

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=user_schema.UserResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user)
):
    """
    Mengambil profil user saat ini.
    Jika user belum ada di DB, akan dibuat otomatis dengan role STRANGER.
    """
    user = await user_service.get_or_create_user(db, firebase_user)
    return user

@router.post("/me/onboard", response_model=user_schema.OnboardingResponse)
async def onboard_me(
    onboarding_data: user_schema.OnboardingRequest,
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user)
):
    """
    Menyelesaikan proses onboarding dengan mendaftarkan lokasi rumah.
    """
    user_in_db = await user_service.get_or_create_user(db, firebase_user)
    
    updated_user = await user_service.onboard_user(
        db, user_in_db.id, onboarding_data.home_location
    )
    
    message = (
        f"Selamat! Anda terverifikasi sebagai warga RT {updated_user.rt_zone.zone_number} RW {updated_user.rw_zone.zone_number}."
        if updated_user.is_verified and updated_user.rt_zone and updated_user.rw_zone
        else "Lokasi Anda di luar zona terdaftar. Hubungi RT setempat untuk verifikasi."
    )
    
    return {"user": updated_user, "message": message}