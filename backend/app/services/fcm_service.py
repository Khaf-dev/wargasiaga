# backend/app/services/fcm_service.py
# EXISTING function send_multicast_async DIPERTAHANKAN agar tidak break callers
# TAMBAH: send_panic_notification + send_incident_update untuk dipakai di Phase 4+
import asyncio
from concurrent.futures import ThreadPoolExecutor
from firebase_admin import messaging
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)

# ThreadPoolExecutor: Firebase Admin SDK sinkronus, jangan block event loop FastAPI
executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix='fcm-worker')


# ─── EXISTING FUNCTION — JANGAN HAPUS ──────────────────────────────────────────
# Dipanggil oleh incident_service.py atau caller lain yang sudah ada
async def send_multicast_async(
    tokens: List[str],
    title: str,
    body: str,
    data: Dict[str, str]
):
    """
    Mengirim notifikasi FCM secara non-blocking.
    Interface lama dipertahankan untuk backward compatibility.
    """
    if not tokens:
        logger.warning("[FCM] Tidak ada token FCM untuk dikirim.")
        return

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        data=data,
        tokens=tokens
    )

    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            executor,
            messaging.send_each_for_multicast,
            message
        )
        logger.info(
            f"[FCM] Terkirim: {response.success_count} sukses, {response.failure_count} gagal."
        )
        if response.failure_count > 0:
            for idx, resp in enumerate(response.responses):
                if not resp.success:
                    logger.error(f"[FCM] Gagal kirim ke token index {idx}: {resp.exception}")
    except Exception as e:
        logger.error(f"[FCM] Error fatal saat mengirim FCM: {e}")


# ─── NEW: Panic notification dengan payload lengkap ────────────────────────────
async def send_panic_notification(
    tokens: List[str],
    incident_id: str,
    reporter_name: str,
    reporter_role: str,
    distance_meters: int,
    is_stranger: bool,
    ai_summary: Optional[str] = None,
) -> Dict:
    """
    Kirim panic alert dengan data lengkap ke FCM.
    Dipakai dari incidents.py route saat POST /panic.
    Return: summary {success_count, failure_count, invalid_tokens}
    """
    if not tokens:
        logger.warning("[FCM] Tidak ada token — panic notification tidak dikirim")
        return {"success_count": 0, "failure_count": 0, "invalid_tokens": []}

    dist_text = (
        f"{distance_meters}m"
        if distance_meters < 1000
        else f"{distance_meters / 1000:.1f} km"
    )

    if is_stranger:
        title = "⚠️ Insiden dari Pelapor Tidak Dikenal"
        body = f"Seseorang (belum terverifikasi) butuh bantuan — {dist_text} dari kamu"
    else:
        title = "🚨 Waspada! Ada Insiden Terdekat"
        body = f"{reporter_name} butuh bantuan — {dist_text} dari lokasimu"

    # FCM max 500 token per multicast — auto-batch
    aggregated: Dict = {"success_count": 0, "failure_count": 0, "invalid_tokens": []}
    loop = asyncio.get_event_loop()

    for i in range(0, len(tokens), 500):
        batch = tokens[i: i + 500]
        message = messaging.MulticastMessage(
            notification=messaging.Notification(title=title, body=body),
            data={
                "incident_id": str(incident_id),
                "type": "panic_alert",
                "reporter_name": reporter_name,
                "reporter_role": reporter_role,
                "distance_meters": str(distance_meters),
                "is_stranger": str(is_stranger).lower(),
                "ai_summary": ai_summary or "",
            },
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon="/favicon.svg",
                    tag=f"wargasiaga-{incident_id}",
                    require_interaction=True,
                ),
            ),
            tokens=batch,
        )
        try:
            response = await loop.run_in_executor(
                executor, messaging.send_each_for_multicast, message
            )
            aggregated["success_count"] += response.success_count
            aggregated["failure_count"] += response.failure_count

            # Kumpulkan invalid token untuk dibersihkan dari DB
            for idx, resp in enumerate(response.responses):
                if not resp.success and resp.exception:
                    err_code = getattr(resp.exception, "code", "")
                    if err_code in (
                        "registration-token-not-registered",
                        "invalid-registration-token",
                    ):
                        aggregated["invalid_tokens"].append(batch[idx])
        except Exception as e:
            logger.error(f"[FCM] Batch {i // 500 + 1} error: {e}")
            aggregated["failure_count"] += len(batch)

    logger.info(
        f"[FCM] Panic sent | incident={incident_id} | "
        f"success={aggregated['success_count']} | failed={aggregated['failure_count']}"
    )
    return aggregated


# ─── NEW: Update status insiden (false alarm, resolved) ────────────────────────
async def send_incident_update(
    tokens: List[str],
    incident_id: str,
    update_type: str,  # 'false_alarm' | 'resolved' | 'responder_joined'
    body: str,
) -> Dict:
    """
    Kirim update status insiden ke reporter + responders.
    Dipakai Phase 6 (Anti-Prank) dan Phase 4 (Responder actions).
    """
    if not tokens:
        return {"success_count": 0, "failure_count": 0}

    title_map = {
        "false_alarm": "✅ Laporan Dibatalkan",
        "resolved": "✅ Situasi Telah Aman",
        "responder_joined": "👋 Ada Tetangga yang Membantu",
    }

    message = messaging.MulticastMessage(
        notification=messaging.Notification(
            title=title_map.get(update_type, "📋 Update Insiden"),
            body=body,
        ),
        data={"incident_id": str(incident_id), "type": update_type},
        webpush=messaging.WebpushConfig(
            notification=messaging.WebpushNotification(
                icon="/favicon.svg",
                tag=f"wargasiaga-{incident_id}",  # replace notif lama, tidak rebuzz
            ),
        ),
        tokens=tokens,
    )
    try:
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            executor, messaging.send_each_for_multicast, message
        )
        logger.info(
            f"[FCM] Update sent | type={update_type} | "
            f"success={response.success_count} | failed={response.failure_count}"
        )
        return {
            "success_count": response.success_count,
            "failure_count": response.failure_count,
        }
    except Exception as e:
        logger.error(f"[FCM] send_incident_update error: {e}")
        return {"success_count": 0, "failure_count": len(tokens)}