from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from app.db.session import get_db
from app.api.auth import get_current_user, FirebaseUser
from app.services import user_service
from app.schemas import user as user_schema
from app.models import User

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=user_schema.UserResponse)
async def get_me(
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user)
):
    user = await user_service.get_or_create_user(db, firebase_user)
    return user

@router.post("/me/onboard", response_model=user_schema.OnboardingResponse)
async def onboard_me(
    onboarding_data: user_schema.OnboardingRequest,
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user)
):
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

@router.patch("/me/fcm-token")
async def update_fcm_token(
    payload: user_schema.FCMTokenUpdate,
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user)
):
    user = await user_service.get_or_create_user(db, firebase_user)
    
    # KUNCI: Jangan pernah overwrite dengan null kalau user sudah punya token
    if not payload.fcm_token:
        return {"message": "Token kosong, update dibatalkan."}
        
    stmt = update(User).where(User.id == user.id).values(fcm_token=payload.fcm_token)
    await db.execute(stmt)
    await db.commit()
    
    return {"message": "FCM token berhasil diupdate"}