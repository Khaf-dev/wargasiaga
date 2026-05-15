from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
# FIX: Tambahkan import 'select'
from sqlalchemy import func, select
from uuid import UUID

from app.db.session import get_db
from app.api.auth import get_current_user, FirebaseUser
from app.services import user_service, incident_service, fcm_service
from app.schemas import incident as incident_schema
from app.db.enums import ResponseType, IncidentStatus
# FIX: Tambahkan import model 'Incident'
from app.models import Incident

router = APIRouter(prefix="/incidents", tags=["Incidents"])

@router.post("/panic")
async def trigger_panic(
    request: incident_schema.PanicRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    firebase_user: FirebaseUser = Depends(get_current_user)
):
    # Dapatkan object user (reporter)
    user = await user_service.get_or_create_user(db, firebase_user)
    
    # 1. Simpan insiden
    incident = await incident_service.create_incident(db, user.id, request)
    
    # 2. Cari target tokens (10 tetangga terdekat verified + RT/RW zona)
    tokens, target_info = await incident_service.get_target_fcm_tokens(db, incident)
    
    # DEBUG: nanti dihapus pas production
    print(f"DEBUG: FCM Tokens ditemukan: {tokens}")
    
    # 3. Payload Notifikasi
    badge = "⚠️ " if incident.is_reporter_stranger else "🚨 "
    title = f"{badge}Laporan Darurat WargaSiaga"
    body = f"{user.full_name} menekan tombol panik! Bantuan dibutuhkan."
    
    fcm_data = {
        "incident_id": str(incident.id),
        "reporter_name": user.full_name,
        "reporter_role": user.role.value,  # ✨ Phase 4.2 fix: kirim role buat IncomingPanicSheet
        "is_stranger": str(incident.is_reporter_stranger).lower()
    }

    # 4. Fire and Forget via BackgroundTasks (non-blocking response)
    background_tasks.add_task(fcm_service.send_multicast_async, tokens, title, body, fcm_data)
    
    return {
        "message": "Laporan panik diterima. Menghubungi tetangga.", 
        "incident_id": incident.id,
        "notified_count": len(tokens)
    }

@router.get("/{incident_id}", response_model=incident_schema.IncidentDetailResponse)
async def get_incident_details(
    incident_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user)
):
    """Mengambil detail lengkap dari sebuah insiden, termasuk reporter dan responders."""
    await user_service.get_or_create_user(db, current_user)
    incident = await incident_service.get_incident_detail(db, incident_id)

    loc_result = (await db.execute(select(func.ST_X(incident.location), func.ST_Y(incident.location)))).first()
    incident_location = incident_schema.Location(lng=loc_result[0], lat=loc_result[1])

    reporter_info = incident_schema.ReporterInfo(
        id=incident.reporter.id,
        full_name=incident.reporter.full_name,
        role=incident.reporter.role.value,
        is_stranger=incident.is_reporter_stranger
    )

    responders_info = []
    total_false_alarm_weight = 0
    for resp in incident.responses:
        resp_loc = None
        if resp.current_location:
            resp_loc_result = (await db.execute(select(func.ST_X(resp.current_location), func.ST_Y(resp.current_location)))).first()
            resp_loc = incident_schema.Location(lng=resp_loc_result[0], lat=resp_loc_result[1])
        
        responders_info.append(incident_schema.ResponderInfo(
            id=resp.responder.id,
            full_name=resp.responder.full_name,
            role=resp.responder.role.value,
            response_type=resp.response_type,
            current_location=resp_loc,
            vote_weight=resp.vote_weight,
            # FIX: Mapping manual dari resp.created_at ke joined_at
            joined_at=resp.created_at
        ))
        if resp.response_type == ResponseType.FALSE_ALARM:
            total_false_alarm_weight += resp.vote_weight

    return incident_schema.IncidentDetailResponse(
        id=incident.id,
        status=incident.status.value,
        location=incident_location,
        audio_url=incident.audio_url,
        audio_duration_sec=incident.audio_duration_sec or 10,
        ai_summary=incident.ai_summary,
        human_address=incident.human_address,
        ai_classification=incident.ai_classification,
        reporter=reporter_info,
        responders=responders_info,
        rt_zone_number=incident.rt_zone.zone_number if incident.rt_zone else None,
        rw_zone_number=incident.rw_zone.zone_number if incident.rw_zone else None,
        created_at=incident.created_at,
        total_vote_weight_false_alarm=total_false_alarm_weight
    )

@router.post("/{incident_id}/respond", response_model=incident_schema.RespondResponse)
async def respond_to_incident(
    incident_id: UUID,
    request: incident_schema.RespondRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user)
):
    """Mengirimkan respons terhadap sebuah insiden (misal: 'Saya ke Lokasi')."""
    responder = await user_service.get_or_create_user(db, current_user)
    response = await incident_service.create_response(db, incident_id, responder, request)
    
    # Ambil status insiden terbaru setelah response diproses
    incident = await db.get(Incident, incident_id)
    is_final = False

    if response.response_type == ResponseType.GOING:
        tokens = await incident_service.get_responders_for_notification(db, incident_id, responder.id)
        background_tasks.add_task(
            fcm_service.send_multicast_async,
            tokens=tokens,
            title="👋 Ada Tetangga yang Membantu",
            body=f"{responder.full_name} sedang menuju lokasi kejadian.",
            data={"incident_id": str(incident_id), "type": "responder_joined"}
        )
    
    if incident.status == IncidentStatus.FALSE_ALARM:
        is_final = True
        tokens = await incident_service.get_responders_for_notification(db, incident_id, responder.id)
        background_tasks.add_task(
            fcm_service.send_multicast_async,
            tokens=tokens,
            title="✅ Laporan Dibatalkan",
            body="Insiden ini telah ditandai sebagai laporan palsu oleh warga.",
            data={"incident_id": str(incident_id), "type": "incident_false_alarm"}
        )

    return incident_schema.RespondResponse(
        message="Respons Anda telah dicatat.",
        response_id=response.id,
        vote_weight=response.vote_weight,
        is_final=is_final,
        incident_status=incident.status.value
    )