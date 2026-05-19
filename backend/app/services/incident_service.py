import logging
logger = logging.getLogger(__name__)

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from uuid import UUID
from geoalchemy2 import Geometry
from typing import List, Tuple
# --- Imports Baru untuk Phase 6.1 ---
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models import Incident, User, NeighborhoodZone, IncidentResponse
from app.schemas.incident import PanicRequest, RespondRequest
from app.db.enums import IncidentStatus, UserRole, ResponseType

# --- Fungsi yang Sudah Ada (Tidak Diubah) ---

async def create_incident(db: AsyncSession, reporter_id: UUID, request: PanicRequest) -> Incident:
    """Membuat record insiden baru, dan mengasosiasikannya dengan zona RT/RW."""
    reporter = await db.get(User, reporter_id)
    if not reporter:
        raise Exception("Reporter tidak ditemukan")

    point_wkt = f'SRID=4326;POINT({request.location.lng} {request.location.lat})'
    point_geom = func.ST_GeogFromText(point_wkt).cast(Geometry)
    
    stmt_zone = select(NeighborhoodZone).where(
        (NeighborhoodZone.zone_type == 'RT') &
        (func.ST_Within(point_geom, NeighborhoodZone.area.cast(Geometry)))
    )
    result_zone = await db.execute(stmt_zone)
    rt_zone = result_zone.scalar_one_or_none()
    
    rt_id = rt_zone.id if rt_zone else None
    rw_id = rt_zone.parent_id if rt_zone else None

    new_incident = Incident(
        reporter_id=reporter_id,
        location=point_wkt,
        audio_url=str(request.audio_url),
        audio_duration_sec=request.audio_duration_sec,
        status=IncidentStatus.ACTIVE,
        is_reporter_stranger=(reporter.role == UserRole.STRANGER),
        rt_id=rt_id,
        rw_id=rw_id
    )
    
    db.add(new_incident)
    await db.commit()
    await db.refresh(new_incident)
    return new_incident

async def get_target_fcm_tokens(db: AsyncSession, incident: Incident) -> Tuple[List[str], List[dict]]:
    """Logic PostGIS untuk menemukan tetangga terdekat dan petugas RT/RW."""
    target_tokens = set()
    target_info =[]

    if incident.rt_id or incident.rw_id:
        stmt_officials = select(User).where(
            User.fcm_token.isnot(None),
            User.role.in_([UserRole.RT, UserRole.RW]),
            or_(User.rt_id == incident.rt_id, User.rw_id == incident.rw_id)
        )
        officials = (await db.execute(stmt_officials)).scalars().all()
        for off in officials:
            if off.fcm_token: target_tokens.add(off.fcm_token)
            target_info.append({"id": str(off.id), "role": off.role.value, "distance": 0})

    incident_geom = func.ST_GeogFromText(func.ST_AsText(incident.location)).cast(Geometry)
    
    stmt_neighbors = select(
        User, 
        func.ST_Distance(User.home_location.cast(Geometry), incident_geom).label("distance")
    ).where(
        User.id != incident.reporter_id,
        User.fcm_token.isnot(None),
        func.ST_DWithin(User.home_location.cast(Geometry), incident_geom, 2000)
    ).order_by("distance").limit(10)
    
    neighbors_result = await db.execute(stmt_neighbors)
    for neighbor, distance in neighbors_result.all():
        if neighbor.fcm_token and neighbor.fcm_token not in target_tokens:
            target_tokens.add(neighbor.fcm_token)
            target_info.append({
                "id": str(neighbor.id), 
                "role": neighbor.role.value, 
                "distance": round(distance)
            })

    return list(target_tokens), target_info

async def get_incident_detail(db: AsyncSession, incident_id: UUID) -> Incident:
    """Mengambil detail insiden beserta data reporter, zona, dan responder."""
    stmt = (
        select(Incident)
        .where(Incident.id == incident_id)
        .options(
            selectinload(Incident.reporter),
            selectinload(Incident.rt_zone),
            selectinload(Incident.rw_zone),
            selectinload(Incident.responses).selectinload(IncidentResponse.responder)
        )
    )
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()

    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insiden tidak ditemukan.")
    
    return incident

async def calculate_vote_weight(user_role: UserRole, response_type: ResponseType) -> int:
    """Menghitung bobot suara berdasarkan role untuk voting laporan palsu."""
    if response_type != ResponseType.FALSE_ALARM:
        return 1
    
    match user_role:
        case UserRole.RW: return 100
        case UserRole.RT: return 2
        case UserRole.WARGA: return 1
        case UserRole.STRANGER: return 0
        case _: return 0

async def get_responders_for_notification(db: AsyncSession, incident_id: UUID, exclude_user_id: UUID) -> List[str]:
    """Mengambil FCM token dari semua partisipan insiden (reporter + responders).
    
    NOTE: Pakai explicit SELECT (bukan rely on incident.reporter relationship)
    karena setelah multiple commit di endpoint, lazy-loaded relationships bisa
    trigger MissingGreenlet di async session.
    """
    tokens: set[str] = set()

    # 1. Ambil reporter FCM token via explicit JOIN (no lazy load)
    reporter_stmt = (
        select(User.fcm_token)
        .join(Incident, Incident.reporter_id == User.id)
        .where(
            Incident.id == incident_id,
            User.id != exclude_user_id,
            User.fcm_token.isnot(None),
        )
    )
    reporter_token = (await db.execute(reporter_stmt)).scalar_one_or_none()
    if reporter_token:
        tokens.add(reporter_token)

    # 2. Ambil responders FCM tokens
    responders_stmt = (
        select(User.fcm_token)
        .join(IncidentResponse, IncidentResponse.responder_id == User.id)
        .where(
            IncidentResponse.incident_id == incident_id,
            User.id != exclude_user_id,
            User.fcm_token.isnot(None),
        )
    )
    result = await db.execute(responders_stmt)
    responder_tokens = result.scalars().all()
    tokens.update(t for t in responder_tokens if t)

    return list(tokens)

# --- Fungsi Baru untuk Phase 6.1 ---

async def _apply_false_alarm_penalty(db: AsyncSession, reporter_id: UUID) -> dict:
    """
    Memberikan penalti kepada pelapor saat insidennya ditandai sebagai laporan palsu.
    
    Aturan:
    1. Skor kepercayaan (trust_score) dikurangi 0.10 (minimal 0.00).
    2. Jika pelapor adalah STRANGER, cek 3 pelanggaran dalam 30 hari terakhir untuk suspensi.
    
    Mengembalikan dict berisi info penalti yang diterapkan untuk logging.
    """
    reporter = await db.get(User, reporter_id)
    if not reporter:
        return {"applied": False, "reason": "Reporter not found"}
    
    penalty_info = {
        "applied": True,
        "old_trust_score": float(reporter.trust_score),
        "new_trust_score": None,
        "suspended": False,
        "false_alarm_count_30d": 0,
    }
    
    # 1. Kurangi trust_score (minimal 0.00), menggunakan aritmatika Decimal.
    new_score = max(Decimal('0.00'), reporter.trust_score - Decimal('0.10'))
    reporter.trust_score = new_score
    penalty_info["new_trust_score"] = float(new_score)
    
    # 2. Cek aturan 3 pelanggaran untuk STRANGER.
    if reporter.role == UserRole.STRANGER:
        # Naive UTC untuk match column TIMESTAMP WITHOUT TIME ZONE di DB.
        thirty_days_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
        false_alarm_count_stmt = select(func.count(Incident.id)).where(
            Incident.reporter_id == reporter_id,
            Incident.status == IncidentStatus.FALSE_ALARM,
            Incident.created_at >= thirty_days_ago,
        )
        count = (await db.execute(false_alarm_count_stmt)).scalar() or 0
        penalty_info["false_alarm_count_30d"] = count
        
        # Catatan: `count` sudah termasuk insiden yang baru saja ditandai palsu.
        if count >= 3:
            # Suspensi berarti user tidak lagi terverifikasi (jika sebelumnya sempat terverifikasi)
            # dan mungkin perlu intervensi manual dari RT/RW untuk diaktifkan kembali.
            reporter.is_verified = False
            penalty_info["suspended"] = True
    
    await db.commit()
    return penalty_info

# --- Fungsi yang Dimodifikasi ---

async def create_response(
    db: AsyncSession,
    incident_id: UUID,
    responder: User,
    request: RespondRequest
) -> IncidentResponse:
    """Membuat respons baru untuk sebuah insiden dan memproses logika voting jika perlu."""
    incident = await db.get(Incident, incident_id)
    response_type_enum = ResponseType(request.response_type)

    # Validasi
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insiden tidak ditemukan.")
    if incident.status != IncidentStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insiden ini sudah ditutup.")
    if incident.reporter_id == responder.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Anda tidak bisa merespon laporan Anda sendiri.")
    if response_type_enum == ResponseType.FALSE_ALARM and responder.role == UserRole.STRANGER:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Anda tidak memiliki hak untuk melakukan voting.")
    if response_type_enum == ResponseType.GOING and not request.current_location:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lokasi wajib diisi untuk respons 'Saya ke Lokasi'.")

    vote_weight = await calculate_vote_weight(responder.role, response_type_enum)
    
    new_response = IncidentResponse(
        incident_id=incident_id,
        responder_id=responder.id,
        response_type=response_type_enum,
        current_location=f'SRID=4326;POINT({request.current_location.lng} {request.current_location.lat})' if request.current_location else None,
        notes=request.notes,
        vote_weight=vote_weight
    )
    
    try:
        db.add(new_response)
        await db.commit()
        await db.refresh(new_response)
    except IntegrityError as e:
        await db.rollback()
        
        # Cek SQLSTATE code untuk diferensiasi error
        # 23505 = unique_violation (legitimate duplicate)
        # 23514 = check_violation (bad enum value, dll)
        # 23503 = foreign_key_violation
        sqlstate = getattr(e.orig, 'sqlstate', None) if hasattr(e, 'orig') else None
        
        if sqlstate == '23505':
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Anda sudah pernah merespon insiden ini dengan tipe yang sama."
            )
        elif sqlstate == '23514':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Data tidak valid: {e.orig}"
            )
        elif sqlstate == '23503':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Referensi data tidak valid (insiden atau user tidak ditemukan)."
            )
        else:
            print(f"Unexpected IntegrityError sqlstate={sqlstate}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Terjadi kesalahan database. Silakan coba lagi."
            )

    # --- Anti-Prank Logic (Phase 6) ---
    if response_type_enum == ResponseType.FALSE_ALARM:
        # Hanya hitung vote yang masuk dalam 3 menit terakhir untuk validitas.
        # Naive UTC untuk match column TIMESTAMP WITHOUT TIME ZONE di DB.
        three_minutes_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=3)
        
        total_weight_stmt = select(func.sum(IncidentResponse.vote_weight)).where(
            IncidentResponse.incident_id == incident_id,
            IncidentResponse.response_type == ResponseType.FALSE_ALARM,
            IncidentResponse.created_at >= three_minutes_ago,
        )
        total_weight = (await db.execute(total_weight_stmt)).scalar() or 0
        
        # Threshold 6 poin (dalam 3 menit), ATAU 1 suara dari RW (bobot 100)
        if total_weight >= 6 or vote_weight >= 100:
            incident.status = IncidentStatus.FALSE_ALARM
            incident.resolved_at = func.now()
            await db.commit()
            await db.refresh(incident)
            
            # Terapkan penalti ke pelapor setelah insiden resmi ditutup sebagai palsu.
            penalty_info = await _apply_false_alarm_penalty(db, incident.reporter_id)
            # Log ini akan muncul di terminal backend untuk debugging/monitoring.
            logger.info(f"[Phase6] Penalty applied to reporter {incident.reporter_id}: {penalty_info}")
            
    return new_response