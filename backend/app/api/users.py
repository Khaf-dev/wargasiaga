from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
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


@router.patch("/me/data-diri", response_model=user_schema.DataDiriUpdateResponse)
async def update_my_data_diri(
    data: user_schema.DataDiriRequest,
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user)
):
    """
    Phase 8.4: Pendataan data diri WARGA.
    Optional untuk diisi, tapi kalau diisi harus lengkap (validasi Pydantic).
    NIK unique — kalau sudah dipakai user lain, return HTTP 409.
    """
    user = await user_service.get_or_create_user(db, firebase_user)
    try:
        updated_user = await user_service.update_data_diri(db, user.id, data)
    except IntegrityError:
        # NIK duplikat (partial unique index uq_users_nik di DB)
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="NIK ini sudah terdaftar di akun lain. Periksa kembali NIK Anda."
        )
    return {
        "data": updated_user,
        "message": "Data diri berhasil disimpan. Terima kasih sudah melengkapi data!"
    }


@router.get("/me/data-diri", response_model=user_schema.DataDiriResponse)
async def get_my_data_diri(
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user)
):
    """
    Phase 8.4: Ambil data diri user (untuk prefill form / edit mode).
    Field bisa null kalau user belum pernah isi. Usia computed dari birth_date.
    """
    user = await user_service.get_or_create_user(db, firebase_user)
    # DataDiriResponse pakai from_attributes — usia di-compute otomatis dari birth_date
    return user