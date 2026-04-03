import hashlib
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Cookie, HTTPException


SESSION_TTL_DAYS = 30


def hash_pin(pin: str, salt: str) -> str:
    """Hash a PIN with PBKDF2-HMAC-SHA256."""
    dk = hashlib.pbkdf2_hmac('sha256', pin.encode('utf-8'), salt.encode('utf-8'), 100000)
    return dk.hex()


def generate_salt() -> str:
    return secrets.token_hex(16)


def generate_token() -> str:
    return secrets.token_urlsafe(32)


def get_current_user(session_token: Optional[str] = Cookie(None)):
    """
    FastAPI dependency that validates the session cookie and returns the user_id.
    Raises HTTP 401 if the token is missing, invalid, or expired.
    """
    # Import here to avoid circular imports
    from server import SessionLocal, UserSession
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = SessionLocal()
    try:
        session = db.query(UserSession).filter(
            UserSession.token == session_token,
            UserSession.expires_at > datetime.utcnow()
        ).first()
        if not session:
            raise HTTPException(status_code=401, detail="Session expired or invalid")
        return session.user_id
    finally:
        db.close()
