# تقرير الخطوتين 4 و5 — محرك RAG + الإيجنت

> التاريخ: 2026-11-20 · الحالة: **مكتملتان، وكل الاختبارات ناجحة** · لم يُعمل `git push`.

## ملخص سريع
| الاختبار | النتيجة |
|---|---|
| `smoke_test.py` | ✅ 19/19 |
| `rag_test.py` | ✅ 37/37 |
| `agent_test.py` | ✅ 50/50 |

- العتبة المختارة: **`similarity_threshold = 0.59`** (حُفظت في `ai_settings`، الإصدار الآن 5).
- قاعدة البيانات نظيفة بعد الاختبارات: لا أقسام ولا منشورات ولا مقاطع ولا مراكز ولا سجلات تجريبية متبقية.

---

## الخطوة 4: محرك RAG (`backend/app/rag/`)

| الملف | ما يفعله |
|---|---|
| `embeddings.py` | `gemini-embedding-001` عبر google-genai، `output_dimensionality=768`، `RETRIEVAL_DOCUMENT` للمقاطع و`RETRIEVAL_QUERY` للأسئلة، تطبيع L2، دفعات من 50، وإعادة محاولة بانتظار متزايد (2، 4، 8… حتى 60 ث) عند 429 و5xx وانتهاء المهلة. الفهرسة: حتى 6 محاولات. سؤال المستخدم: محاولتان فقط حتى لا ينتظر طويلاً. |
| `chunking.py` | تنظيف HTML (مع الحفاظ على حدود الفقرات)، مقاطع ~1000 حرف حسب الفقرات (والفقرة الطويلة تُقسَّم على حدود الجمل)، تداخل ~150 حرفاً، وكل مقطع يبدأ بـ `العنوان: …` أو `Title: …`. |
| `indexer.py` | `index_post`: يحسب الـ embeddings **أولاً** ثم يحذف القديم ويحفظ الجديد ويحدّث `indexed_at` (إن فشل Gemini يبقى الفهرس القديم سليماً). العربية تُقطَّع بعنوانها العربي والإنجليزية بعنوانها الإنجليزي. `unindex_post`: يحذف المقاطع ويجعل `indexed_at=NULL`. `reindex_all`: المنشورة فقط، وينظّف مقاطع أي منشور غير منشور. |
| `search.py` | `search(query, lang, top_k)` عبر RPC `match_post_chunks`، يجمع حسب المنشور بأعلى درجة، ويرجع `post_id, slug, title, section, similarity, best_chunk, chunk_lang`. |

**الربط في `admin_posts.py`:**
- `POST /publish` ← نشر ثم `index_post`. فشل الفهرسة لا يلغي النشر، ويرجع `index_warning` في الرد.
- `PUT` على منشور منشور غيّر `title_ar/title_en/content_ar/content_en` ← `index_post`. تغيير الوسوم وغيرها لا يعيد الفهرسة.
- `PUT` غيّر الحالة من published إلى draft أو review ← `unindex_post`.
- ردود publish و PUT و reindex تحتوي الآن على: `indexed`, `chunks`, `index_warning`, `indexed_at`.

**تحديثات أخرى:** `indexed_at` أُضيف إلى `schema.sql` و`models.py` (Post) و`schemas.py` (PostListItem) و`CLAUDE.md`.

### نتائج rag_test.py: درجات التشابه
البيانات التجريبية: 3 مواد محايدة (زراعة الطماطم، صيانة الدراجة، تنظيم وقت المذاكرة). مادة الدراجة بلا نسخة إنجليزية عمداً.

**أسئلة مطابقة** (المادة الصحيحة أولاً في 7/7):

| السؤال | الصحيحة | الثانية |
|---|---|---|
| كم ساعة شمس تحتاج نبتة الطماطم؟ | garden **0.7568** | time 0.5134 |
| كيف أسقي الطماطم في البيت؟ | garden **0.7212** | time 0.4923 |
| كيف أنظف سلسلة الدراجة وأزيتها؟ | bike **0.7335** | garden 0.4843 |
| متى أغير وسائد الفرامل في الدراجة؟ | bike **0.6534** | time 0.4909 |
| كيف أنظم وقت المذاكرة قبل الامتحان؟ | time **0.7732** | bike 0.5227 |
| How should I organize my study time before exams? | time **0.7474** | garden 0.5352 |
| How much sunlight do tomato plants need? | garden **0.7280** | time 0.4829 |

**أسئلة بعيدة** (كلها تحت العتبة):

| السؤال | أعلى درجة |
|---|---|
| ما هي عاصمة أستراليا؟ | 0.4728 |
| كم تبلغ المسافة بين الأرض والقمر؟ | 0.4531 |
| ما أفضل طريقة لتعلم العزف على البيانو؟ | 0.5301 |
| What is the capital of Australia? | 0.4958 |

**اختيار العتبة:** أضعف تطابق صحيح 0.6534، وأقوى سؤال بعيد 0.5301، والمنتصف بينهما **0.59**.

> ⚠️ هذه الدرجات من 3 مواد متباعدة جداً في الموضوع. مع المحتوى الحقيقي (كله في مجال واحد) ستكون درجات الأسئلة القريبة من المجال أعلى. **أعد المعايرة بعد إدخال المحتوى الحقيقي** عبر «مختبر الاختبار» `/api/admin/ai/test`، والأرجح أن العتبة المناسبة ستكون بين 0.60 و0.70.

اختبارات أخرى ناجحة: المقاطع بلغتها الصحيحة، تبدأ كلها بالعنوان، بلا HTML. تعديل المحتوى يعيد الفهرسة وتظهر الجملة الجديدة في المقاطع. تغيير الوسوم فقط لا يعيد الفهرسة. إرجاع المنشور لمسودة يحذف مقاطعه ويخفيه من البحث. إعادة فهرسة مسودة تُرفض (400). إعادة البناء الكاملة لا تفهرس المسودة.

---

## الخطوة 5: الإيجنت (`backend/app/agent/`)

| الملف | ما يفعله |
|---|---|
| `llm.py` | استدعاء Gemini Flash بسلسلة نماذج بديلة (`gemini-3.5-flash-lite` ثم `gemini-3.8-flash`) ومهلة 15 ث لكل محاولة. إذا فشلت كل النماذج يرجع `None`، ولا يتوقف المساعد. |
| `classifier.py` | مخرجات JSON منظمة (`response_json_schema`): `category` (أحد المسارات الأربعة أو `unknown`) و`lang`. يعامل السؤال كنص غير موثوق (لا ينفّذ أي تعليمات بداخله). إذا فشل النموذج: `unknown` + كشف اللغة بعدّ الحروف. |
| `guidance.py` | جملة توجيه من **عنوان المادة واسم القسم فقط**، فلا المحتوى ولا السؤال يصلان للنموذج، وهذا يمنع أيضاً حقن التعليمات من المستخدم. القواعد الثابتة في الكود، ثم `guidance_prompt` للأسلوب. بعد التوليد يُتحقق من: ≤ 30 كلمة، سطر واحد، وخلوّه من مؤشرات الأحكام أو الاقتباس (قال الله، حديث، حلال، حرام، فتوى…). إذا فشل التحقق أو فشل Gemini يُستخدم قالب ثابت. |
| `pipeline.py` | التصنيف والـ embedding **بالتوازي** ← بحث ← قرار. في match: `post.content` يُقرأ من جدول `posts` مباشرة ولا يمر على أي نموذج. يستخدمه `/api/chat` و`/api/admin/ai/test` معاً، فالمختبر يعرض نفس سلوك المساعد تماماً. |

**نموذج رد match:**
```json
{"type":"match","guidance":"…","post":{"id","slug","title","section","content","lang","lang_fallback",
 "summary","source_name","external_ref","file_url","content_type"},"related":[…≤3],"sources":[…مع similarity],"log_id":1}
```
**نموذج رد fallback:**
```json
{"type":"fallback","message":"(من ai_settings)","closest":{"post_id","slug","title","section","similarity"}|null,
 "referrals":[{"id","name","country","url","contact"}],"log_id":2}
```

### نتائج agent_test.py (50/50)
- ✅ رد match: `post.content == content_ar` في القاعدة (مقارنة `==`)، وكذلك `content_en` للإنجليزية.
- ✅ `lang=en` لمادة بلا نسخة إنجليزية: يرجع العربية حرفياً مع `lang_fallback=true`.
- ✅ سؤال بعيد: fallback مع رسالة ai_settings و`referrals` و`closest` (درجته 0.4957، تحت العتبة)، ولا يحتوي أي نص مادة.
- ✅ `chat_logs` سجّلت الأسئلة الأربعة بقيم `is_fallback` صحيحة، و`feedback` يعمل (1 / -1)، و404 لسجل غير موجود.
- ✅ `/ai/test` يرجع التصنيف وكل النتائج والعتبة والقرار والمعاينة، **ولا يسجّل** في chat_logs، ويرفض الطلب بدون JWT.
- ✅ `/ai/settings`: GET، و PUT يزيد `version`، وعتبة 1.5 تُرفض (422).
- ✅ `/ai/logs?fallback=true`، و`/ai/unanswered` (جمّع سؤالين متطابقين بعدد 2 مع أقرب مادة)، و`/dashboard/stats`، و CRUD المراكز.
- ✅ حد الطلبات: الطلب رقم 21 في الدقيقة يرجع 429 مع `Retry-After`.

مثال جملة توجيه فعلية (مع `guidance_prompt` الحالي):
> أهلاً بك. نود إفادتك بأن مادة "زراعة الطماطم في حديقة المنزل" المعروضة أسفل الرسالة ضمن "قسم تجريبي للاختبار" تتناول موضوعك، ونرجو منك قراءتها للاستفادة. (24 كلمة)

اختبار يدوي للتصنيف (5/5 صحيحة): الحوار مع غير المسلم → methodology، ماذا يعتقد المسلمون عن الله → intro_islam، كيف أتوضأ بعد إسلامي → new_muslim، الإسلام انتشر بالسيف → shubuhat، عاصمة أستراليا → unknown.

---

## القرارات التي اتخذتها
1. **نماذج Gemini:** `gemini-2.5-flash` لم يعد متاحاً لهذا المفتاح (404)، و`gemini-3.5-flash` و`gemini-3.8-flash` رجعا 504 و503 أثناء التجربة. اخترت `gemini-3.5-flash-lite` (الأسرع والأثبت) أولاً ثم `gemini-3.8-flash` احتياطياً. يمكن تغيير الترتيب من `.env` بـ `GEMINI_CHAT_MODELS=a,b` دون تعديل الكود. نموذج الـ embeddings: `gemini-embedding-001` (يدعم task_type، ويمكن تغييره بـ `GEMINI_EMBED_MODEL`، لكن تغييره يتطلب إعادة فهرسة كاملة).
2. **التصنيف لا يصفّي البحث:** يُستخدم للتسجيل والتحليل فقط، حتى لا يضيع تطابق صحيح بسبب تصنيف خاطئ.
3. **البحث بالإنجليزية يشمل المقاطع العربية أيضاً** (النموذج متعدد اللغات)، حتى تظهر المواد التي لم تُترجم بعد، وتُعرض بالعربية مع `lang_fallback`.
4. **لغة جملة التوجيه ورسالة البدائل = لغة السؤال المكتشفة**، أما `lang` في الطلب فهو لغة المادة المعروضة.
5. **chat_logs.lang = لغة المادة المطلوبة.** وفي fallback يُحفظ أقرب منشور ودرجته في `matched_post_id/score` (مع `is_fallback=true`)، حتى تعرض شاشة «الأسئلة غير المجابة» أقرب مادة ونسبتها.
6. **فشل embedding السؤال ← 503** «المساعد غير متاح مؤقتاً» بدل fallback كاذب، حتى لا يمتلئ «غير المجابة» بأسئلة لم تُبحث أصلاً. أما فشل التصنيف أو التوجيه فلا يوقف شيئاً، ويُستخدم الاحتياطي.
7. **حد الطلبات** يأخذ **آخر** عنوان في `X-Forwarded-For`، لأن العميل يستطيع تزوير القيم الأولى (Render يضع proxy واحداً).
8. **«اليوم» في الإحصاءات بتوقيت UTC.**
9. **حالة «يحتاج إعادة فهرسة» (stale)** في index-status = `updated_at > indexed_at + 30 ث`. الهامش لأن الـ trigger الحالي في قاعدتك يحدّث `updated_at` حتى عند كتابة `indexed_at` وحدها (انظر البند الأول في المطلوب منك).
10. المسار القديم `/api/search?q=` في CLAUDE.md لم يُنفّذ بعد، وعلّمته «لم يُنفّذ بعد».

## مشاكل لم تُحل / المطلوب منك
1. **(اختياري لكنه مستحسن) تحديث الـ trigger في Supabase:** عدّلت الدالة `set_updated_at()` في `backend/db/schema.sql` بحيث لا يغيّر تحديثُ `indexed_at` وحده قيمةَ `updated_at`. **الصق `schema.sql` كاملاً في SQL Editor ثم Run** (آمن للتكرار). كل شيء يعمل بدونه بفضل هامش الـ 30 ثانية، لكن بعده يصبح `updated_at` دقيقاً (آخر تعديل حقيقي من المحرر).
2. **إعادة معايرة العتبة** بعد إدخال المحتوى الحقيقي، كما في التحذير أعلاه.
3. **توفر Gemini متذبذب** (503 «high demand» أحياناً). أثناء الاختبار فشل النموذجان مرة واحدة في التصنيف فرجع `unknown`، وكان هذا سلوكاً متوقعاً وليس خطأ. إذا تكرر في العرض أمام المحكّمين فكّر في مفتاح بخطة مدفوعة.
4. **حد الطلبات في الذاكرة** يعمل لكل عملية (process). مع أكثر من worker على Render يصبح الحد لكل worker، وهذا كافٍ للهاكاثون.
5. **ai_settings لا يحتوي `updated_at`** ولا سجل إصدارات، وشاشة الإعدادات في التصميم تطلب «آخر تعديل» و«استرجاع إصدار سابق». يحتاج هذا عموداً أو جدول `ai_settings_history` عبر SQL Editor، فأخبرني إن أردته.
6. تغيير الوسوم أو المصدر فقط في منشور منشور سيجعله يظهر stale بعد 30 ث (لا يمكن التمييز بلا hash للمحتوى). إعادة الفهرسة تحل الأمر بنقرة.

## كل الـ endpoints الجديدة/المعدّلة
| الطريقة | المسار | الحماية | الوصف |
|---|---|---|---|
| POST | `/api/admin/posts/{id}/publish` | JWT | (معدّل) نشر + فهرسة، يرجع `indexed/chunks/index_warning` |
| PUT | `/api/admin/posts/{id}` | JWT | (معدّل) يعيد الفهرسة أو يلغيها تلقائياً |
| POST | `/api/admin/posts/{id}/reindex` | JWT | إعادة فهرسة منشور منشور (400 لغير المنشور، 502 لفشل Gemini) |
| POST | `/api/admin/ai/reindex` | JWT | إعادة بناء الفهرس بالكامل |
| GET | `/api/admin/ai/index-status` | JWT | ملخص (indexed/stale/pending/chunks/آخر فهرسة) + حالة كل منشور |
| GET | `/api/admin/ai/settings` | JWT | الإعدادات الفعّالة + أسماء النماذج + من عدّلها |
| PUT | `/api/admin/ai/settings` | JWT | `guidance_prompt, similarity_threshold (0–1), top_k (1–10), fallback_message_ar/en`، وكل حفظ يزيد `version` |
| POST | `/api/admin/ai/test` | JWT | `{message, lang}` ← التصنيف، كل النتائج بدرجاتها و`above_threshold`، العتبة، القرار، `preview`، ولا يسجّل |
| GET | `/api/admin/ai/logs?fallback=&page=&page_size=` | JWT | سجل الأسئلة مع عنوان المنشور |
| GET | `/api/admin/ai/unanswered?limit=` | JWT | أسئلة fallback مجمّعة (تطبيع التشكيل وعلامات الترقيم) مع `count, last_at, closest` |
| GET/POST | `/api/admin/referral-centers` | JWT | قائمة / إضافة |
| GET/PUT/DELETE | `/api/admin/referral-centers/{id}` | JWT | عرض / تعديل / حذف |
| GET | `/api/admin/dashboard/stats` | JWT | الأقسام، المنشورات حسب الحالة، المفهرسة، المقاطع، أسئلة اليوم، نسبة fallback (اليوم والكلي) |
| POST | `/api/chat` | عام + 20/دقيقة/IP | `{message (≤1000), lang, session_id}` ← match أو fallback + `log_id` |
| POST | `/api/chat/feedback` | عام | `{log_id, helpful}` |

## الملفات
- جديدة: `app/rag/{__init__,embeddings,chunking,indexer,search}.py` · `app/agent/{__init__,llm,classifier,guidance,pipeline}.py` · `app/routers/{chat,admin_ai,admin_misc}.py` · `app/ai_config.py` · `testkit.py` · `rag_test.py` · `agent_test.py`
- معدّلة: `db/schema.sql` · `app/{config,models,schemas,utils,main}.py` · `app/routers/admin_posts.py` · `CLAUDE.md`

## كيف تتحقق
```powershell
cd backend
.venv\Scripts\python.exe smoke_test.py
.venv\Scripts\python.exe rag_test.py --no-save   # بدون --no-save يحفظ العتبة المقترحة
.venv\Scripts\python.exe agent_test.py
.venv\Scripts\python.exe -m uvicorn app.main:app --reload   # ثم http://127.0.0.1:8000/docs
```
