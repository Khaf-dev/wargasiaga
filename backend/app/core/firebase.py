import firebase_admin
from firebase_admin import credentials, auth
from app.core.config import settings

def initialize_firebase_app():
    """
    Inisialisasi Firebase Admin SDK jika belum ada.
    Menggunakan service account dari path di .env.
    """
    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
        firebase_admin.initialize_app(cred)
    print("Firebase App initialized.")

# Kita panggil di startup FastAPI nanti