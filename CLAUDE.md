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
posts(id, section_id, slug, title_ar, title_en, content_ar, content_en, summary_ar, tags[], external_ref, topic, source_name, content_type[article|booklet|leaflet|shubha_response], file_url, status[draft|review|published], created_by, reviewed_by, published_at, updated_at, indexed_at, review_note*)
  (*review_note اختياري: ALTER في schema.sql؛ الـ Backend يعمل بدونه ويرجع note_saved=false)
post_chunks(id, post_id, lang, chunk_index, chunk_text, embedding vector)
ai_settings(id, guidance_prompt, similarity_threshold, top_k, fallback_message_ar, fallback_message_en, version, is_active, updated_by, updated_at)
ai_settings_history(id, version, guidance_prompt, similarity_threshold, top_k, fallback_message_ar, fallback_message_en, updated_by, saved_at) — نسخة من الصف قبل كل PUT/استرجاع
referral_centers(id, name, country, url, contact)
chat_logs(id, session_id, question, detected_category, lang, matched_post_id, score, is_fallback, feedback, ignored, created_at)
  (ignored = «تجاهل» في الأسئلة غير المجابة: يُستبعد من القائمة والعدّاد)
users(id, name, email, password_hash, role[admin|editor])

## الـ API
Auth: POST /api/auth/login, GET|PUT /api/auth/me {name, email}, PUT /api/auth/me/password {current_password, new_password}
Admin (JWT): /api/admin/sections, /api/admin/posts (?status=&section_id=&content_type=&lang=en|ar_only&q=&page=), POST /api/admin/posts/{id}/publish,
  POST /api/admin/posts/{id}/reindex, POST /api/admin/posts/{id}/return-to-draft {note?},
  GET|PUT /api/admin/ai/settings, GET /api/admin/ai/settings/history, POST /api/admin/ai/settings/restore/{history_id}, POST /api/admin/ai/reindex, GET /api/admin/ai/index-status, POST /api/admin/ai/test,
  GET /api/admin/ai/logs?fallback=&page=, GET /api/admin/ai/unanswered?period=7d|30d|all, POST /api/admin/ai/unanswered/ignore {question},
  CRUD /api/admin/referral-centers,
  GET /api/admin/dashboard/stats, GET /api/admin/dashboard/activity, GET /api/admin/dashboard/system-status?refresh=
Public (بدون JWT، المنشور فقط وفي أقسام مفعّلة):
  GET /api/sections?category= (+posts_count يشمل الفرعية) · /api/categories · /api/topics?category=&section=
  GET /api/posts?q=&section=&category=&topic=&content_type=&lang=en&tag=&page=&page_size= (بطاقات: excerpt + reading_minutes + has_en + section)
  GET /api/posts/latest?limit= · /api/posts/{slug} (+reading_minutes) · /api/posts/{slug}/related · /api/sections/{slug}/posts · /api/referral-centers
  وقت القراءة = كلمات النص / 200 (دقيقة على الأقل). excerpt = الملخص أو أول سطور النص المنشور نفسه.
Agent: POST /api/chat {message, lang, session_id} -> {type: match|fallback, ..., sources, threshold, log_id}, POST /api/chat/feedback {log_id, helpful}
  (حد 20 طلباً/دقيقة لكل IP في الذاكرة)

## محرك RAG (backend/app/rag/) — الخطوة 4
- embeddings.py: gemini-embedding-001، 768 بُعداً، RETRIEVAL_DOCUMENT للمقاطع و RETRIEVAL_QUERY للأسئلة، تطبيع L2، دفعات 50، إعادة محاولة متزايدة عند 429/5xx.
- chunking.py: ~1000 حرف حسب الفقرات + تداخل ~150، تنظيف HTML، كل مقطع يبدأ بـ "العنوان: ..." / "Title: ...".
- indexer.py: index_post (embeddings أولاً ثم استبدال المقاطع + indexed_at)، unindex_post، reindex_all (المنشورة فقط).
- search.py: search(query, lang, top_k) عبر match_post_chunks، تجميع حسب المنشور بأعلى درجة. lang=en يبحث في en و ar معاً.
- الربط: publish -> index_post. PUT على منشور منشور غيّر title/content -> index_post. إلغاء النشر -> unindex_post. فشل الفهرسة = index_warning في الرد ولا يلغي الحفظ.
- العتبة الحالية similarity_threshold = 0.59 (من rag_test.py على بيانات تجريبية؛ أعد معايرتها بالمحتوى الحقيقي).

## الإيجنت (backend/app/agent/) — الخطوة 5
- llm.py: سلسلة نماذج Flash (GEMINI_CHAT_MODELS، الافتراضي gemini-3.5-flash-lite ثم gemini-3.8-flash) بمهلة 15 ث؛ فشل الكل -> None.
- classifier.py: JSON منظم {category (المسارات الأربعة|unknown), lang}؛ احتياطي: unknown + كشف اللغة بالحروف. التصنيف للتسجيل فقط ولا يصفّي البحث.
- guidance.py: ≤ 30 كلمة من العنوان واسم القسم فقط (لا المحتوى ولا السؤال)؛ قواعد ثابتة ثم guidance_prompt؛ تحقق طول + كلمات ممنوعة، وإلا قالب ثابت.
- pipeline.py: تصنيف و embedding بالتوازي -> بحث -> match (post.content حرفياً من posts) أو fallback (رسالة ai_settings + closest + referral_centers). يُستخدم في /api/chat و /api/admin/ai/test.
- chat_logs: في fallback يُحفظ أقرب منشور ودرجته في matched_post_id/score (للأسئلة غير المجابة). lang = لغة المادة المطلوبة.

## لوحة التحكم (frontend/) — الخطوة 6
- Next.js 16 (App Router، cacheComponents=false) + TypeScript + Tailwind v4 (الـ tokens في app/globals.css داخل @theme) + Radix (radix-ui) + lucide-react + TipTap 3 + sonner + DOMPurify.
- <html lang="ar" dir="rtl">، Tajawal + Inter عبر next/font. خصائص منطقية فقط (ms/me/ps/pe/start/end).
- lib/api.ts: عميل موحد (JWT من localStorage `daiah.token`، أخطاء عربية، 401 -> حدث يحوّل لـ /admin/login?next=). lib/auth.tsx: AuthProvider. lib/use-api.ts: useApi.
- components/ui/: المكونات المشتركة (ApprovedTextCard, GuidanceBubble, FallbackCard, SourceChip, StatCard, StatusDot, Stepper, DataTable, ...). /design-system يعرضها.
- app/admin/login + app/admin/(panel)/* (محمية في layout). أي HTML منشور يُعرض عبر SafeHtml (DOMPurify).
- frontend/.env.local: NEXT_PUBLIC_API_URL=http://localhost:8000 فقط (لا أسرار في الواجهة).

## الموقع العام (frontend/app/(site)/) — الخطوة 7
- الصفحات: / · /assistant · /library · /posts/[slug] · /shubuhat · /intro · /new-muslim + app/not-found.tsx و (site)/not-found.tsx.
- مكونات خادم تجلب من الـ API عبر lib/public-api.ts (API_URL للخادم ثم NEXT_PUBLIC_API_URL)؛ البحث الفوري في الشبهات والمساعد من المتصفح عبر lib/site-api.ts (بلا JWT).
- اللغة: كوكي daiah.lang (ar افتراضياً | en). proxy.ts يمرر x-daiah-path، و app/layout.tsx يضبط lang/dir على <html> (اللوحة و /design-system عربية دائماً).
  نصوص الواجهة في lib/i18n/dictionaries.ts فقط (بلا أي محتوى شرعي). المحتوى الإنجليزي إن وُجد وإلا العربي مع تنبيه.
- الأقسام والمسارات والتصنيفات وخطوات المسلم الجديد تُقرأ من القاعدة؛ عند غيابها EmptyState.
- المساعد: session_id في localStorage (daiah.chat.session)، لغة المادة (daiah.chat.lang)، المحادثة في sessionStorage. /assistant?q= يرسل تلقائياً.
  النص المعروض = post.content حرفياً عبر SafeHtml (DOMPurify). لوحة المصادر بدرجات التشابه وخط العتبة (Bottom Sheet على الجوال). 429/503/شبكة = رسائل واضحة.
- components/ui/answer.tsx مشتركة بين المختبر والموقع، وتقبل labels للإنجليزية.

## الاختبارات (من مجلد backend، على Supabase و Gemini الحقيقيين، وتحذف بياناتها)
e2e_run.py (يشغّل frontend/scripts/e2e-check.mjs: صفحات اللوحة والموقع بالعربية والإنجليزية + 404 + سيناريو كامل حتى /api/chat؛ يتطلب السيرفرين يعملان، ويحذف سجلات المحادثة التي ينشئها) · public_test.py (المسارات العامة + التجاهل والفترة) · smoke_test.py · rag_test.py (يحفظ العتبة المقترحة؛ --no-save لمنعه) · agent_test.py · testkit.py (بيانات محايدة مشتركة)

## الأمان
- المفاتيح في backend/.env فقط (SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD). لا تعرض قيمها أبداً ولا تطبعها.
- لا تحذف .env من .gitignore.

## طريقة العمل
- خطوة بخطوة، ولا تنتقل لخطوة جديدة قبل موافقتي.
- بعد كل خطوة اشرح لي باختصار بالعربي ماذا فعلت وكيف أتحقق.
