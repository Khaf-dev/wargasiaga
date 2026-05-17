import logging
import httpx
import json
from google import genai
from app.core.config import settings

# Inisialisasi logger untuk modul ini
logger = logging.getLogger(__name__)

# Konfigurasi client Gemini di level modul agar bisa di-reuse (best practice)
try:
    _client = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception as e:
    logger.error(f"Gagal menginisialisasi Gemini Client: {e}. Pastikan GEMINI_API_KEY sudah benar.")
    _client = None

MODEL_NAME = "gemini-2.5-flash"

async def validate_connection() -> dict:
    """Melakukan 'ping' sederhana ke API Gemini untuk validasi koneksi dan API key."""
    if not _client:
        return {"status": "error", "error": "Gemini client tidak terinisialisasi."}
    
    try:
        response = await _client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=["Reply with: OK"]
        )
        preview = response.text[:100]
        status = "ok" if "OK" in preview else "error"
        return {"status": status, "model": MODEL_NAME, "response_preview": preview}
    except Exception as e:
        logger.error(f"Validasi koneksi Gemini gagal: {e}")
        return {"status": "error", "model": MODEL_NAME, "error": str(e)}

async def classify_panic_audio(audio_url: str) -> dict:
    """Menganalisis audio dari URL, mengklasifikasikannya, dan mengembalikan format JSON."""
    if not _client:
        return {"status": "error", "error": "Gemini client tidak terinisialisasi."}

    logger.info(f"Memulai klasifikasi audio dari URL: {audio_url}")
    
    try:
        # Langkah 1: Download audio dari URL menggunakan httpx async
        async with httpx.AsyncClient() as client:
            response = await client.get(audio_url, timeout=30.0)
            response.raise_for_status()
            audio_bytes = response.content

        # Langkah 2: Kirim audio bytes ke Gemini dengan prompt terstruktur
        prompt = """
Kamu adalah AI keamanan komunitas. Analisis audio rekaman ini yang berasal dari tombol panik darurat di aplikasi Siskamling.

Klasifikasikan audio dan berikan response HANYA dalam format JSON valid (tanpa markdown code block, tanpa penjelasan tambahan):

{
  "detected": "kategori utama suara (contoh: 'teriakan minta tolong', 'pertengkaran', 'suara normal', 'suara kerusuhan', 'ledakan', 'tangisan')",
  "transcript": "transkripsi suara dalam Bahasa Indonesia jika ada kata yang terdengar, atau '[tidak ada ucapan jelas]' jika tidak ada",
  "urgency": "LOW | MEDIUM | HIGH | CRITICAL",
  "reasoning": "alasan singkat 1-2 kalimat dalam Bahasa Indonesia"
}

Panduan urgency:
- CRITICAL: ada ancaman nyawa langsung (teriakan sangat panik, suara kekerasan, tembakan)
- HIGH: situasi darurat (pertengkaran besar, kebakaran, kemalingan terdengar)
- MEDIUM: situasi mencurigakan (suara aneh, percakapan agresif)
- LOW: kemungkinan salah picu (suara biasa, sepi, suara latar belakang)
"""
        
        gemini_response = await _client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=[prompt, {"mime_type": "audio/webm", "data": audio_bytes}]
        )

        # Langkah 3: Parsing JSON response dengan fallback
        raw_text = gemini_response.text.strip()
        
        # Handle jika Gemini mengembalikan markdown code block
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:-3].strip()
        
        result = json.loads(raw_text)
        logger.info(f"Klasifikasi audio berhasil. Urgensi: {result.get('urgency')}")
        return result

    except httpx.HTTPStatusError as e:
        logger.error(f"Gagal download audio dari {audio_url}: {e}")
        return {"error": "Failed to download audio file."}
    except json.JSONDecodeError:
        logger.error(f"Gagal parse JSON dari respons Gemini. Raw: {gemini_response.text[:500]}")
        return {
            "detected": "unknown", "transcript": "[gagal parse AI response]",
            "urgency": "MEDIUM", "reasoning": "AI response tidak valid JSON.",
            "raw_response": gemini_response.text[:500]
        }
    except Exception as e:
        logger.error(f"Error tidak diketahui saat klasifikasi audio: {e}")
        return {"error": str(e)}

async def generate_incident_summary(classification: dict, reporter_name: str, address: str | None) -> str:
    """Membuat ringkasan insiden 1-2 kalimat untuk petugas."""
    if not _client:
        return "Ringkasan AI tidak tersedia (client tidak terinisialisasi)."

    prompt = f"""
Buat ringkasan situasi darurat 1-2 kalimat Bahasa Indonesia berdasarkan data berikut, untuk ditampilkan ke petugas RT/RW:

Pelapor: {reporter_name}
Lokasi: {address or "Lokasi belum teridentifikasi"}
Kategori suara: {classification.get("detected", "N/A")}
Transkripsi: {classification.get("transcript", "N/A")}
Tingkat urgensi: {classification.get("urgency", "N/A")}
Analisis AI: {classification.get("reasoning", "N/A")}

Buat ringkasan singkat, padat, faktual. Mulai dengan situasi (apa yang terjadi), lokasi (singkat), dan saran tindakan.
Tidak perlu menambahkan kata "Berikut ringkasan" atau pembuka. Langsung ke isi.

Contoh output:
"Terdengar teriakan minta tolong dari Pak Budi di Jl. Merdeka. Urgensi tinggi, segera tinjau lokasi."
"""
    try:
        response = await _client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=[prompt]
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"Gagal membuat ringkasan insiden: {e}")
        return "Ringkasan AI tidak tersedia saat ini."