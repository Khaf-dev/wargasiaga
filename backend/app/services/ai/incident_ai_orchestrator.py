import logging
import uuid
from sqlalchemy import update
from app.db.session import AsyncSessionLocal
from app.models.incident import Incident
from app.services.ai import gemini_service, geocoding_service

# Setup logger untuk modul ini
logger = logging.getLogger(__name__)

async def process_panic_ai(
    incident_id: uuid.UUID,
    audio_url: str | None,
    lat: float,
    lng: float,
    reporter_name: str
) -> None:
    """
    Orkestrasi proses AI di background setelah insiden dibuat.
    Melakukan reverse geocode, klasifikasi audio, dan pembuatan ringkasan, lalu update ke DB.
    Dijalankan sebagai background task, sehingga tidak boleh melempar exception.
    """
    logger.info(f"[AI-Orchestrator] Memulai proses AI untuk insiden {incident_id}")

    # Langkah 1: Reverse Geocoding (cepat, ~500ms)
    human_address: str | None = None
    try:
        result = await geocoding_service.reverse_geocode(lat, lng)
        if result and result.get("formatted_address"):
            human_address = result["formatted_address"]
            logger.info(f"[AI-Orchestrator] Geocode OK: {human_address}")
        else:
            logger.warning(f"[AI-Orchestrator] Geocode tidak menemukan hasil untuk {lat},{lng}")
    except Exception as e:
        logger.error(f"[AI-Orchestrator] Geocode error: {e}")

    # Langkah 2: Klasifikasi Audio (berat, ~3-5s)
    ai_classification: dict | None = None
    if audio_url:
        try:
            ai_classification = await gemini_service.classify_panic_audio(audio_url)
            logger.info(f"[AI-Orchestrator] Klasifikasi audio OK: urgensi={ai_classification.get('urgency')}")
        except Exception as e:
            logger.error(f"[AI-Orchestrator] Klasifikasi audio error: {e}")
    else:
        logger.warning("[AI-Orchestrator] Tidak ada audio_url, melewati proses klasifikasi.")
    
    # Langkah 3: Membuat Ringkasan Cerdas (medium, ~2-3s)
    ai_summary: str | None = None
    if ai_classification and not ai_classification.get("error"):
        try:
            ai_summary = await gemini_service.generate_incident_summary(
                classification=ai_classification,
                reporter_name=reporter_name,
                address=human_address
            )
            logger.info(f"[AI-Orchestrator] Ringkasan AI OK: {ai_summary[:80]}...")
        except Exception as e:
            logger.error(f"[AI-Orchestrator] Gagal membuat ringkasan: {e}")
            
    # Langkah 4: Update data insiden di database
    # WAJIB menggunakan session baru karena background task berjalan di luar request lifecycle.
    try:
        async with AsyncSessionLocal() as db:
            update_data = {}
            if human_address is not None:
                update_data["human_address"] = human_address
            if ai_classification is not None:
                update_data["ai_classification"] = ai_classification
            if ai_summary is not None:
                update_data["ai_summary"] = ai_summary
            
            if not update_data:
                logger.warning(f"[AI-Orchestrator] Tidak ada data AI untuk diupdate pada insiden {incident_id}")
                return
            
            stmt = update(Incident).where(Incident.id == incident_id).values(**update_data)
            await db.execute(stmt)
            await db.commit()
            logger.info(f"[AI-Orchestrator] DB berhasil diupdate untuk insiden {incident_id}: fields={list(update_data.keys())}")
    except Exception as e:
        logger.error(f"[AI-Orchestrator] DB update error: {e}")

    logger.info(f"[AI-Orchestrator] Proses AI untuk insiden {incident_id} selesai.")