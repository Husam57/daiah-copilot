"""نماذج Pydantic للتحقق من البيانات — مطابقة لجداول db/schema.sql.

- <Table>Create: ما يُرسل عند الإنشاء (بدون id والحقول التي تولّدها القاعدة).
- <Table>: الصف كما يرجع من Supabase.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .config import EMBEDDING_DIM

Category = Literal["methodology", "shubuhat", "intro_islam", "new_muslim"]
PostStatus = Literal["draft", "review", "published"]
Role = Literal["admin", "editor"]
Lang = Literal["ar", "en"]
ContentType = Literal["article", "booklet", "leaflet", "shubha_response"]


class _Model(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


# ---------- users ----------
class UserCreate(_Model):
    name: str = Field(min_length=1)
    email: EmailStr
    password_hash: str
    role: Role = "editor"


class User(_Model):
    """لا يحتوي password_hash عمداً حتى لا يُعاد في أي استجابة."""
    id: int
    name: str
    email: str
    role: Role


# ---------- sections ----------
class SectionCreate(_Model):
    parent_id: int | None = None
    name_ar: str = Field(min_length=1)
    name_en: str | None = None
    slug: str = Field(min_length=1, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    category: Category
    description: str | None = None
    sort_order: int = 0
    is_active: bool = True


class Section(SectionCreate):
    id: int


# ---------- posts ----------
class PostCreate(_Model):
    section_id: int
    slug: str = Field(min_length=1, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    title_ar: str = Field(min_length=1)
    title_en: str | None = None
    content_ar: str = Field(min_length=1)
    content_en: str | None = None
    summary_ar: str | None = None
    tags: list[str] = Field(default_factory=list)
    external_ref: str | None = None
    topic: str | None = None
    source_name: str | None = None
    content_type: ContentType = "article"
    file_url: str | None = None
    status: PostStatus = "draft"


class Post(PostCreate):
    id: int
    review_note: str | None = None  # ملاحظة المراجع عند الإرجاع لمسودة (عمود اختياري)
    created_by: int | None = None
    reviewed_by: int | None = None
    published_at: datetime | None = None
    updated_at: datetime
    indexed_at: datetime | None = None  # آخر فهرسة RAG ناجحة (None = غير مفهرس)


# ---------- post_chunks ----------
class PostChunkCreate(_Model):
    post_id: int
    lang: Lang
    chunk_index: int = Field(ge=0)
    chunk_text: str = Field(min_length=1)
    embedding: list[float] | None = Field(
        default=None, min_length=EMBEDDING_DIM, max_length=EMBEDDING_DIM
    )


class PostChunk(_Model):
    id: int
    post_id: int
    lang: Lang
    chunk_index: int
    chunk_text: str


class ChunkMatch(_Model):
    """صف واحد من نتيجة RPC match_post_chunks."""
    post_id: int
    chunk_text: str
    similarity: float


# ---------- ai_settings ----------
class AISettingsCreate(_Model):
    guidance_prompt: str = ""
    similarity_threshold: float = Field(default=0.75, ge=0, le=1)
    top_k: int = Field(default=5, gt=0)
    fallback_message_ar: str = Field(min_length=1)
    fallback_message_en: str = Field(min_length=1)
    version: int = 1
    is_active: bool = False
    updated_by: int | None = None


class AISettings(AISettingsCreate):
    id: int
    updated_at: datetime | None = None


# ---------- ai_settings_history ----------
class AISettingsHistory(_Model):
    """نسخة من صف ai_settings كما كان قبل تعديله (تُحفظ قبل كل PUT/استرجاع)."""
    id: int
    version: int
    guidance_prompt: str
    similarity_threshold: float
    top_k: int
    fallback_message_ar: str
    fallback_message_en: str
    updated_by: int | None = None
    saved_at: datetime


# ---------- referral_centers ----------
class ReferralCenterCreate(_Model):
    name: str = Field(min_length=1)
    country: str | None = None
    url: str | None = None
    contact: str | None = None


class ReferralCenter(ReferralCenterCreate):
    id: int


# ---------- chat_logs ----------
class ChatLogCreate(_Model):
    session_id: str = Field(min_length=1)
    question: str = Field(min_length=1)
    detected_category: Category | None = None
    lang: Lang | None = None
    matched_post_id: int | None = None
    score: float | None = None
    is_fallback: bool = False
    feedback: Literal[-1, 1] | None = None  # 1 = مفيد، -1 = غير مفيد
    ignored: bool = False  # «تجاهل» في الأسئلة غير المجابة


class ChatLog(ChatLogCreate):
    id: int
    created_at: datetime
