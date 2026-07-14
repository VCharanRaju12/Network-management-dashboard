from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_fernet = Fernet(settings.CREDENTIAL_ENCRYPTION_KEY.encode())


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_token(subject: str, role: str, expires_minutes: int, token_type: str = "access") -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "type": token_type,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: str, role: str) -> str:
    return create_token(subject, role, settings.ACCESS_TOKEN_EXPIRE_MINUTES, "access")


def create_refresh_token(subject: str, role: str) -> str:
    return create_token(subject, role, settings.REFRESH_TOKEN_EXPIRE_MINUTES, "refresh")


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def encrypt_secret(plaintext: str) -> str:
    """Encrypts a credential (e.g. SNMP community string) before storing it."""
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_secret(stored_value: str) -> str:
    """
    Decrypts a stored credential. Falls back to returning the value as-is if
    it isn't actually encrypted — this handles devices created before
    encryption was added, so existing data keeps working rather than
    breaking outright. Every device created or updated from now on gets
    properly encrypted going forward; there's no separate migration script
    for pre-existing plaintext values, since the fallback makes one
    unnecessary for this project's scale.
    """
    try:
        return _fernet.decrypt(stored_value.encode()).decode()
    except InvalidToken:
        return stored_value
