import asyncio
from concurrent.futures import ThreadPoolExecutor
from firebase_admin import messaging
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

# Gunakan ThreadPoolExecutor agar Firebase SDK yang synchronous
# tidak memblokir async event loop FastAPI
executor = ThreadPoolExecutor()

async def send_multicast_async(tokens: List[str], title: str, body: str, data: Dict[str, str]):
    """
    Mengirim notifikasi FCM secara non-blocking.
    """
    if not tokens:
        logger.warning("Tidak ada token FCM untuk dikirim.")
        return

    message = messaging.MulticastMessage(
        notification=messaging.Notification(
            title=title,
            body=body
        ),
        data=data,
        tokens=tokens
    )

    try:
        # Jalankan blocking I/O di thread terpisah
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            executor,
            messaging.send_each_for_multicast,
            message
        )
        
        logger.info(f"FCM terkirim: {response.success_count} sukses, {response.failure_count} gagal.")
        
        if response.failure_count > 0:
            for idx, resp in enumerate(response.responses):
                if not resp.success:
                    logger.error(f"Gagal kirim ke token index {idx}: {resp.exception}")
    except Exception as e:
        logger.error(f"Error fatal saat mengirim FCM: {e}")