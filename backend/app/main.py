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

from .ai_config import settings_cache
from .cache import invalidate_public
from .config import redact, settings
from .routers import admin_ai, admin_import, admin_misc, admin_posts, admin_sections, auth, chat, public

log = logging.getLogger("daiah")

app = FastAPI(
    title="رفيق الداعية — API",
    description="لوحة التحكم + الموقع العام + المساعد. الردود الشرعية من المواد المعتمدة حرفياً.",
    version="0.5.0",
    # التوثيق التفاعلي في التطوير فقط (لا نعرض خريطة الـ API في الإنتاج)
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

if settings.is_production and not settings.cors_origins:
    log.warning("CORS_ORIGINS فارغ في الإنتاج: لن تستطيع الواجهة الاتصال بالـ API. أضف رابط Vercel.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.middleware("http")
async def invalidate_caches(request: Request, call_next):
    """أي تعديل ناجح في اللوحة (POST/PUT/DELETE على /api/admin/…) يُبطل كاش المسارات العامة
    وكاش الإعدادات، فيظهر النشر والتعديل في الموقع والمساعد فوراً."""
    response = await call_next(request)
    path = request.url.path
    if (request.method not in ("GET", "HEAD", "OPTIONS")
            and (path.startswith("/api/admin/") or path == "/api/auth/me")  # اسم المراجع يظهر في الموقع
            and response.status_code < 400 and path != "/api/admin/ai/test"):
        invalidate_public()
        settings_cache.clear()
    return response


app.include_router(auth.router)
app.include_router(admin_sections.router)
app.include_router(admin_import.router)
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
    "string_too_long": "النص أطول من المسموح",
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
    if t == "string_too_short":
        n = err.get("ctx", {}).get("min_length", 1)
        return "لا يمكن أن يكون فارغاً" if n <= 1 else f"يجب ألا يقل عن {n} أحرف"
    if t == "value_error" and "email" in str(err.get("msg", "")).lower():
        return "بريد إلكتروني غير صحيح"
    if t == "value_error":  # رسائل المدققات المخصصة (عربية)
        return str(err.get("msg", "")).removeprefix("Value error, ") or "قيمة غير صحيحة"
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


def _cors_headers(request: Request) -> dict:
    """معالج Exception العام يعمل خارج CORSMiddleware، فنضيف الترويسات يدوياً
    حتى ترى الواجهة رسالة الخطأ العربية بدل خطأ CORS."""
    origin = request.headers.get("origin")
    if origin and origin in settings.cors_origins:
        return {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Vary": "Origin"}
    return {}


_NETWORK_ERRORS = ("ConnectError", "ConnectTimeout", "ReadTimeout", "RemoteProtocolError", "ReadError", "WriteError")


@app.exception_handler(Exception)
async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
    log.error("Unhandled %s: %s", type(exc).__name__, redact(str(exc)))
    if type(exc).__name__ in _NETWORK_ERRORS:
        return JSONResponse(
            status_code=503,
            content={"detail": "تعذّر الاتصال بخدمة خارجية (قاعدة البيانات أو Gemini) مؤقتاً، حاول مرة أخرى"},
            headers=_cors_headers(request),
        )
    return JSONResponse(
        status_code=500, content={"detail": "حدث خطأ غير متوقع في الخادم"}, headers=_cors_headers(request)
    )
