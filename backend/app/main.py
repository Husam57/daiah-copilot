"""تطبيق FastAPI — رفيق الداعية.

التشغيل (من مجلد backend):  .venv\\Scripts\\python.exe -m uvicorn app.main:app --reload
التوثيق التفاعلي:  http://127.0.0.1:8000/docs
"""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import redact, settings
from .routers import admin_ai, admin_misc, admin_posts, admin_sections, auth, chat, public

log = logging.getLogger("daiah")

app = FastAPI(
    title="رفيق الداعية — API",
    description="لوحة التحكم + الموقع العام + المساعد. الردود الشرعية من المواد المعتمدة حرفياً.",
    version="0.5.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin_sections.router)
app.include_router(admin_posts.router)
app.include_router(admin_ai.router)
app.include_router(admin_misc.centers)
app.include_router(admin_misc.dashboard)
app.include_router(public.router)
app.include_router(chat.router)


@app.get("/api/health", tags=["system"], summary="فحص عمل الخادم")
def health() -> dict:
    return {"status": "ok"}


# ============ رسائل الأخطاء بالعربية ============
_DEFAULT_HTTP_MESSAGES = {
    "Not Found": "المسار غير موجود",
    "Method Not Allowed": "هذه الطريقة غير مسموحة لهذا المسار",
}

_VALIDATION_MESSAGES = {
    "missing": "حقل مطلوب",
    "string_too_short": "لا يمكن أن يكون فارغاً",
    "string_pattern_mismatch": "صيغة غير صحيحة (حروف إنجليزية صغيرة وأرقام وشرطات فقط)",
    "string_type": "يجب أن يكون نصاً",
    "int_parsing": "يجب أن يكون رقماً صحيحاً",
    "int_type": "يجب أن يكون رقماً صحيحاً",
    "bool_parsing": "يجب أن يكون true أو false",
    "bool_type": "يجب أن يكون true أو false",
    "list_type": "يجب أن يكون قائمة",
    "greater_than_equal": "القيمة أصغر من المسموح",
    "less_than_equal": "القيمة أكبر من المسموح",
    "json_invalid": "صيغة JSON غير صحيحة",
    "model_attributes_type": "يجب أن يكون كائن JSON",
}


def _validation_message(err: dict) -> str:
    t = err.get("type", "")
    if t == "literal_error":
        expected = str(err.get("ctx", {}).get("expected", "")).replace(" or ", "، ")
        return "قيمة غير مسموحة. المسموح: " + expected
    if t == "value_error" and "email" in str(err.get("msg", "")).lower():
        return "بريد إلكتروني غير صحيح"
    return _VALIDATION_MESSAGES.get(t, "قيمة غير صحيحة")


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {
            "field": ".".join(str(p) for p in e.get("loc", ()) if p not in ("body", "query", "path")),
            "message": _validation_message(e),
        }
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422, content={"detail": "البيانات المرسلة غير صحيحة", "errors": errors}
    )


@app.exception_handler(StarletteHTTPException)
async def http_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = _DEFAULT_HTTP_MESSAGES.get(exc.detail, exc.detail) if isinstance(exc.detail, str) else exc.detail
    return JSONResponse(status_code=exc.status_code, content={"detail": detail}, headers=exc.headers)


_DB_ERRORS = {
    "23505": (409, "قيمة مكررة: يوجد سجل آخر بنفس البيانات"),
    "23503": (409, "لا يمكن تنفيذ العملية لارتباطها بسجلات أخرى"),
    "23514": (400, "قيمة غير مسموحة لأحد الحقول"),
    "23502": (400, "حقل مطلوب لم يُرسل"),
    "22P02": (400, "صيغة إحدى القيم غير صحيحة"),
}


@app.exception_handler(APIError)
async def db_handler(_: Request, exc: APIError) -> JSONResponse:
    code, msg = _DB_ERRORS.get(exc.code or "", (500, "حدث خطأ في قاعدة البيانات، حاول مرة أخرى"))
    if code == 500:
        log.error("Supabase APIError %s: %s", exc.code, redact(str(exc.message)))
    return JSONResponse(status_code=code, content={"detail": msg})


@app.exception_handler(Exception)
async def unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
    log.error("Unhandled %s: %s", type(exc).__name__, redact(str(exc)))
    return JSONResponse(status_code=500, content={"detail": "حدث خطأ غير متوقع في الخادم"})
