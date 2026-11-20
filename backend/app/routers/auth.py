"""تسجيل الدخول + بيانات المستخدم الحالي."""
import secrets

from fastapi import APIRouter, Depends, HTTPException, status

from ..db import get_supabase
from ..schemas import LoginRequest, TokenResponse, User
from ..security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# hash وهمي: نشغّل bcrypt حتى لو البريد غير موجود، فلا يكشف زمن الاستجابة وجود الحساب
_DUMMY_HASH = hash_password(secrets.token_hex(16))


@router.post("/login", response_model=TokenResponse, summary="تسجيل الدخول")
def login(body: LoginRequest) -> TokenResponse:
    rows = (
        get_supabase().table("users").select("id, name, email, role, password_hash")
        .eq("email", body.email.lower()).limit(1).execute().data
    )
    row = rows[0] if rows else None
    ok = verify_password(body.password, row["password_hash"] if row else _DUMMY_HASH)
    if not row or not ok:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "البريد الإلكتروني أو كلمة المرور غير صحيحة"
        )
    user = User(**row)
    token, expires_in = create_access_token(user)
    return TokenResponse(access_token=token, expires_in=expires_in, user=user)


@router.get("/me", response_model=User, summary="المستخدم الحالي")
def me(user: User = Depends(get_current_user)) -> User:
    return user
