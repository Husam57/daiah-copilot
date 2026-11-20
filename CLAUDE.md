# رفيق الداعية (Da'iah Copilot) - هاكاثون شراع 2026
منصة مرجعية دعوية (على غرار الإسلام سؤال وجواب) من 3 أجزاء: لوحة تحكم + موقع عام + إيجنت ذكي.

## القاعدة الذهبية (Zero Hallucination) - في الكود، لا تُعدّل من اللوحة
- النموذج لا يولّد أي رد شرعي. الرد المعروض = content_ar/content_en من جدول posts حرفياً + external_ref.
- دور النموذج فقط: تصنيف السؤال، تحديد اللغة، صياغة جملة توجيه قصيرة.
- إذا أعلى تشابه < similarity_threshold: fallback = "غير متوفرة" + أقرب مادة + referral_centers.
- يُفهرس فقط ما حالته published. البحث على post_chunks، والعرض من posts كاملاً.
- guidance_prompt من اللوحة يتحكم بالأسلوب فقط ويُدمج بعد قواعد النظام الثابتة.

## المسارات (category)
methodology | shubuhat | intro_islam | new_muslim

## التقنيات
- backend/: Python 3.11+ + FastAPI + supabase-py + Pydantic
- frontend/: Next.js (App Router) + TypeScript + Tailwind، RTL عربي، /admin للوحة التحكم
- قاعدة البيانات: Supabase PostgreSQL + pgvector
  - الاتصال عبر supabase-py (HTTPS) بمفتاح service role، في الـ Backend فقط (لا يصل للـ frontend أبداً).
  - لا اتصال Postgres مباشر. الجداول تُنشأ بلصق backend/db/schema.sql في Supabase SQL Editor.
  - RLS مفعّل على كل الجداول بدون سياسات (مفتاح anon لا يقرأ شيئاً). البحث المتجهي عبر RPC: match_post_chunks.
- الذكاء الاصطناعي: Gemini API عبر مكتبة google-genai (embeddings + نموذج Flash)
- النشر: Vercel (frontend) + Render (backend)

## الجداول
sections(id, parent_id, name_ar, name_en, slug, category, description, sort_order, is_active)
posts(id, section_id, slug, title_ar, title_en, content_ar, content_en, summary_ar, tags[], external_ref, topic, source_name, content_type[article|booklet|leaflet|shubha_response], file_url, status[draft|review|published], created_by, reviewed_by, published_at, updated_at)
post_chunks(id, post_id, lang, chunk_index, chunk_text, embedding vector)
ai_settings(id, guidance_prompt, similarity_threshold, top_k, fallback_message_ar, fallback_message_en, version, is_active, updated_by)
referral_centers(id, name, country, url, contact)
chat_logs(id, session_id, question, detected_category, lang, matched_post_id, score, is_fallback, feedback, created_at)
users(id, name, email, password_hash, role[admin|editor])

## الـ API
Auth: POST /api/auth/login, GET /api/auth/me
Admin (JWT): /api/admin/sections, /api/admin/posts, POST /api/admin/posts/{id}/publish,
  /api/admin/ai/settings, /api/admin/ai/reindex, /api/admin/ai/index-status, /api/admin/ai/test,
  /api/admin/ai/logs, /api/admin/referral-centers
Public: GET /api/sections, /api/sections/{slug}/posts, /api/posts/{slug}, /api/search?q=
Agent: POST /api/chat {message, lang, session_id} -> {type: match|fallback, ...}, POST /api/chat/feedback

## الأمان
- المفاتيح في backend/.env فقط (SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD). لا تعرض قيمها أبداً ولا تطبعها.
- لا تحذف .env من .gitignore.

## طريقة العمل
- خطوة بخطوة، ولا تنتقل لخطوة جديدة قبل موافقتي.
- بعد كل خطوة اشرح لي باختصار بالعربي ماذا فعلت وكيف أتحقق.
