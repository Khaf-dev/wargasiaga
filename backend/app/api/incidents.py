from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.auth import get_current_user, FirebaseUser
from app.services import user_service, incident_service, fcm_service
from app.schemas.incident import PanicRequest

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.post("/panic")
async def trigger_panic(
    request: PanicRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user)
):
    # Dapatkan object user (reporter)
    user = await user_service.get_or_create_user(db, firebase_user)
    
    # 1. Simpan insiden
    incident = await incident_service.create_incident(db, user.id, request)
    
    # 2. Cari target tokens
    tokens, target_info = await incident_service.get_target_fcm_tokens(db, incident)
    
    # DEBUG
    print(f"DEBUG: FCM Tokens ditemukan: {tokens}")
    
    # 3. Payload Notifikasi (Menggunakan user.full_name, bukan incident.reporter)
    badge = "⚠️ " if incident.is_reporter_stranger else "🚨 "
    title = f"{badge}Laporan Darurat WargaSiaga"
    body = f"{user.full_name} menekan tombol panik! Bantuan dibutuhkan."
    
    fcm_data = {
        "incident_id": str(incident.id),
        "reporter_name": user.full_name,
        "is_stranger": str(incident.is_reporter_stranger).lower()
    }

    # 4. Fire and Forget via BackgroundTasks
    background_tasks.add_task(fcm_service.send_multicast_async, tokens, title, body, fcm_data)
    
    return {
        "message": "Laporan panik diterima. Menghubungi tetangga.", 
        "incident_id": incident.id,
        "notified_count": len(tokens)
    }