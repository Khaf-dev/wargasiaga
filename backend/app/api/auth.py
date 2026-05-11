from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
from pydantic import BaseModel

# Menggunakan HTTPBearer karena kita mengirim token langsung, bukan via form.
bearer_scheme = HTTPBearer()

class FirebaseUser(BaseModel):
    """Skema untuk data user yang sudah di-decode dari Firebase token."""
    uid: str
    email: str | None = None
    name: str | None = None
    picture: str | None = None

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> FirebaseUser:
    """
    Dependency untuk memverifikasi Firebase ID token dari header 'Authorization: Bearer <token>'
    dan mendapatkan data user.
    """
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header otorisasi tidak ada.",
        )
    
    token = creds.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        return FirebaseUser(
            uid=decoded_token.get("uid"),
            email=decoded_token.get("email"),
            name=decoded_token.get("name"),
            picture=decoded_token.get("picture"),
        )
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sudah kadaluarsa.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Terjadi kesalahan internal saat verifikasi token.",
        )