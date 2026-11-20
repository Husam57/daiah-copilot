"""المصادقة: كلمات المرور (bcrypt) + رموز الدخول JWT (PyJWT, HS256, 12 ساعة)."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .db import get_supabase
from .models import User

JWT_ALGORITHM = "HS256"
TOKEN_TTL = timedelta(hours=12)

# auto_error=False حتى نرجع رسالة عربية بدل رسالة FastAPI الافتراضية
_bearer = HTTPBearer(auto_error=False, description="الصق access_token من /api/auth/login")


def _unauthorized(msg: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=msg,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _secret() -> str:
    if not settings.jwt_secret:
        raise HTTPException(500, "إعداد الخادم ناقص: JWT_SECRET غير موجود في backend/.env")
    return settings.jwt_secret


# ---------- كلمات المرور ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:  # hash تالف أو كلمة مرور أطول من 72 بايت
        return False


# ---------- JWT ----------
def create_access_token(user: User) -> tuple[str, int]:
    """يرجع (token, مدة الصلاحية بالثواني)."""
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user.id), "role": user.role, "iat": now, "exp": now + TOKEN_TTL}
    token = jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)
    return token, int(TOKEN_TTL.total_seconds())


def _decode(token: str) -> dict:
    try:
        return jwt.decode(
            token, _secret(), algorithms=[JWT_ALGORITHM], options={"require": ["sub", "exp"]}
        )
    except jwt.ExpiredSignatureError:
        raise _unauthorized("انتهت صلاحية الجلسة، سجّل الدخول من جديد")
    except jwt.InvalidTokenError:
        raise _unauthorized("رمز الدخول غير صالح")


# ---------- Dependencies ----------
def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User:
    """أي مستخدم مسجّل دخوله (يُقرأ من القاعدة في كل طلب حتى يُمنع المستخدم المحذوف فوراً)."""
    if creds is None or creds.scheme.lower() != "bearer":
        raise _unauthorized("يجب تسجيل الدخول أولاً")
    payload = _decode(creds.credentials)
    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise _unauthorized("رمز الدخول غير صالح")
    rows = (
        get_supabase().table("users").select("id, name, email, role")
        .eq("id", user_id).limit(1).execute().data
    )
    if not rows:
        raise _unauthorized("المستخدم غير موجود، سجّل الدخول من جديد")
    return User(**rows[0])


def require_admin_user(user: User = Depends(get_current_user)) -> User:
    """لمسارات لوحة التحكم /api/admin/* — يتطلب دور admin."""
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "ليست لديك صلاحية لهذه العملية")
    return user
