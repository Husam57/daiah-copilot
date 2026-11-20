"""نماذج الطلبات والردود للـ API (مبنية على app/models.py)."""
from datetime import datetime
from typing import Literal

from pydantic import EmailStr, Field

from .models import (
    Category,
    ContentType,
    Post,
    PostCreate,
    Section,
    SectionCreate,
    User,
    _Model,
)

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
# النشر يتم فقط عبر POST /api/admin/posts/{id}/publish (لأنه سيُطلق الفهرسة في الخطوة 4)
EditableStatus = Literal["draft", "review"]


# ---------- auth ----------
class LoginRequest(_Model):
    email: EmailStr
    password: str = Field(min_length=1)


class TokenResponse(_Model):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: User


class MessageResponse(_Model):
    detail: str


# ---------- sections (admin) ----------
class SectionIn(SectionCreate):
    """slug اختياري: يُولَّد من name_en أو رقم عشوائي."""
    slug: str | None = Field(default=None, min_length=1, pattern=SLUG_PATTERN)


class SectionUpdate(_Model):
    """كل الحقول اختيارية: يُحدَّث فقط ما يُرسل."""
    parent_id: int | None = None
    name_ar: str | None = Field(default=None, min_length=1)
    name_en: str | None = None
    slug: str | None = Field(default=None, min_length=1, pattern=SLUG_PATTERN)
    category: Category | None = None
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class SectionAdmin(Section):
    posts_count: int = 0


# ---------- posts (admin) ----------
class PostIn(PostCreate):
    """slug اختياري: يُولَّد من title_en أو رقم عشوائي."""
    slug: str | None = Field(default=None, min_length=1, pattern=SLUG_PATTERN)
    status: EditableStatus = "draft"


class PostUpdate(_Model):
    section_id: int | None = None
    slug: str | None = Field(default=None, min_length=1, pattern=SLUG_PATTERN)
    title_ar: str | None = Field(default=None, min_length=1)
    title_en: str | None = None
    content_ar: str | None = Field(default=None, min_length=1)
    content_en: str | None = None
    summary_ar: str | None = None
    tags: list[str] | None = None
    external_ref: str | None = None
    topic: str | None = None
    source_name: str | None = None
    content_type: ContentType | None = None
    file_url: str | None = None
    status: EditableStatus | None = None


class PostWithIndex(Post):
    """رد النشر/التعديل: المنشور + نتيجة الفهرسة (التحذير لا يعني فشل الحفظ)."""
    indexed: bool = False
    chunks: int | None = None
    index_warning: str | None = None


class PostListItem(_Model):
    """صف في جدول المنشورات (بدون المحتوى الكامل لتخفيف الاستجابة)."""
    id: int
    section_id: int
    slug: str
    title_ar: str
    title_en: str | None = None
    summary_ar: str | None = None
    tags: list[str] = Field(default_factory=list)
    topic: str | None = None
    source_name: str | None = None
    content_type: ContentType
    status: str
    published_at: datetime | None = None
    updated_at: datetime
    indexed_at: datetime | None = None


class PostPage(_Model):
    items: list[PostListItem]
    total: int
    page: int
    page_size: int


# ---------- public ----------
class PublicSection(_Model):
    id: int
    parent_id: int | None = None
    name_ar: str
    name_en: str | None = None
    slug: str
    category: Category
    description: str | None = None
    sort_order: int = 0


class SectionRef(_Model):
    name_ar: str
    name_en: str | None = None
    slug: str
    category: Category


class PublicPostItem(_Model):
    id: int
    slug: str
    title_ar: str
    title_en: str | None = None
    summary_ar: str | None = None
    tags: list[str] = Field(default_factory=list)
    topic: str | None = None
    content_type: ContentType
    published_at: datetime | None = None


class PublicSectionPosts(_Model):
    section: PublicSection
    items: list[PublicPostItem]
    total: int
    page: int
    page_size: int


class PublicPost(_Model):
    """المادة كاملة كما هي في القاعدة (النص المعتمد حرفياً)."""
    id: int
    slug: str
    title_ar: str
    title_en: str | None = None
    content_ar: str
    content_en: str | None = None
    summary_ar: str | None = None
    tags: list[str] = Field(default_factory=list)
    external_ref: str | None = None
    topic: str | None = None
    source_name: str | None = None
    content_type: ContentType
    file_url: str | None = None
    published_at: datetime | None = None
    updated_at: datetime
    section: SectionRef


__all__ = [
    "LoginRequest", "TokenResponse", "MessageResponse", "User",
    "SectionIn", "SectionUpdate", "SectionAdmin", "Section",
    "PostIn", "PostUpdate", "PostListItem", "PostPage", "Post", "PostWithIndex",
    "PublicSection", "SectionRef", "PublicPostItem", "PublicSectionPosts", "PublicPost",
]
