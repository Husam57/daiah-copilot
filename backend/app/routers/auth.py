"""تسجيل الدخول + بيانات المستخدم الحالي."""
import secrets
import threading
import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import EmailStr, Field

from ..db import get_supabase
from ..models import _Model
from ..schemas import LoginRequest, MessageResponse, TokenResponse, User
from ..security import create_access_token, get_current_user, hash_password, verify_password
from .chat import client_ip

router = APIRouter(prefix="/api/auth", tags=["auth"])

# hash وهمي: نشغّل bcrypt حتى لو البريد غير موجود، فلا يكشف زمن الاستجابة وجود الحساب
_DUMMY_HASH = hash_password(secrets.token_hex(16))


# ============ حد المحاولات الفاشلة (في الذاكرة، لكل IP) — ضد تخمين كلمة المرور ============
LOGIN_MAX_FAILS = 10
LOGIN_WINDOW = 15 * 60.0
_fails: dict[str, deque] = defaultdict(deque)
_fails_lock = threading.Lock()


def _recent_fails(ip: str, now: float) -> deque:
    q = _fails[ip]
    while q and now - q[0] > LOGIN_WINDOW:
        q.popleft()
    return q


def reset_login_limit() -> None:
    """للاختبارات فقط."""
    with _fails_lock:
        _fails.clear()


@router.post("/login", response_model=TokenResponse, summary="تسجيل الدخول")
def login(body: LoginRequest, request: Request) -> TokenResponse:
    ip, now = client_ip(request), time.monotonic()
    with _fails_lock:
        q = _recent_fails(ip, now)
        if len(q) >= LOGIN_MAX_FAILS:
            retry = int(LOGIN_WINDOW - (now - q[0])) + 1
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"محاولات دخول فاشلة كثيرة، حاول بعد {max(1, retry // 60)} دقيقة",
                headers={"Retry-After": str(retry)},
            )
    rows = (
        get_supabase().table("users").select("id, name, email, role, password_hash")
        .eq("email", body.email.lower()).limit(1).execute().data
    )
    row = rows[0] if rows else None
    ok = verify_password(body.password, row["password_hash"] if row else _DUMMY_HASH)
    if not row or not ok:
        with _fails_lock:
            _recent_fails(ip, now).append(now)
            if len(_fails) > 10_000:
                for k in [k for k, v in _fails.items() if not v or now - v[-1] > LOGIN_WINDOW]:
                    _fails.pop(k, None)
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "البريد الإلكتروني أو كلمة المرور غير صحيحة"
        )
    user = User(**row)
    token, expires_in = create_access_token(user)
    return TokenResponse(access_token=token, expires_in=expires_in, user=user)


@router.get("/me", response_model=User, summary="المستخدم الحالي")
def me(user: User = Depends(get_current_user)) -> User:
    return user


# ============ حسابي ============
class ProfileUpdate(_Model):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None


class PasswordChange(_Model):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)


@router.put("/me", response_model=User, summary="تعديل الاسم و/أو البريد")
def update_me(body: ProfileUpdate, user: User = Depends(get_current_user)) -> User:
    data = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "لم تُرسل أي حقول للتعديل")
    sb = get_supabase()
    if "email" in data:
        data["email"] = data["email"].lower()
        taken = (
            sb.table("users").select("id").eq("email", data["email"])
            .neq("id", user.id).limit(1).execute().data
        )
        if taken:
            raise HTTPException(status.HTTP_409_CONFLICT, "هذا البريد مستخدم لحساب آخر")
    row = sb.table("users").update(data).eq("id", user.id).execute().data[0]
    return User(**row)


@router.put("/me/password", response_model=MessageResponse, summary="تغيير كلمة المرور")
def change_password(body: PasswordChange, user: User = Depends(get_current_user)) -> MessageResponse:
    sb = get_supabase()
    row = sb.table("users").select("password_hash").eq("id", user.id).limit(1).execute().data[0]
    if not verify_password(body.current_password, row["password_hash"]):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "كلمة المرور الحالية غير صحيحة")
    if len(body.new_password.encode("utf-8")) > 72:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "كلمة المرور الجديدة طويلة جداً (الحد 72 بايت)")
    if body.new_password == body.current_password:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "كلمة المرور الجديدة مطابقة للحالية")
    sb.table("users").update({"password_hash": hash_password(body.new_password)}).eq("id", user.id).execute()
    return MessageResponse(detail="تم تغيير كلمة المرور")
