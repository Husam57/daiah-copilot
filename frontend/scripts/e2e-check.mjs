#!/usr/bin/env node
/**
 * فحص شامل للوحة التحكم (Node 20+ بلا مكتبات إضافية).
 *
 * 1) كل صفحات /admin والموقع العام ترجع 200 و <html lang="ar" dir="rtl">، وبكوكي daiah.lang=en
 *    يصير الموقع lang="en" dir="ltr" بينما تبقى اللوحة عربية. ومسار غير موجود يرجع 404 بنفس الهوية.
 * 2) السيناريو عبر نفس الـ API الذي تستخدمه الواجهة:
 *    دخول ← إنشاء قسم ← إنشاء منشور ← إرسال للمراجعة ← نشره ← ظهوره مفهرساً ←
 *    اختباره في المختبر (match + النص حرفياً) ← يظهر في المكتبة ← صفحته ←
 *    سؤال عنه في /api/chat (match بنص مطابق حرفياً) ← سؤال بعيد (fallback) ← حذفه (ثم حذف القسم).
 *    سجلات المحادثة تُكتب بـ session_id = E2E_SESSION، ويحذفها e2e_run.py بعد الانتهاء.
 *
 * المتطلبات: الـ Backend يعمل (افتراضياً :8000) والواجهة تعمل (افتراضياً :3000).
 * بيانات الدخول: E2E_EMAIL / E2E_PASSWORD (لا تُطبع أبداً). الأسهل: من مجلد backend
 *   .venv\Scripts\python.exe e2e_run.py   (يمرّرها من إعدادات التطبيق كما تفعل الاختبارات)
 * البيانات التجريبية محايدة وتُحذف في النهاية.
 *
 * التشغيل المباشر (من مجلد frontend):  E2E_EMAIL=... E2E_PASSWORD=... node scripts/e2e-check.mjs
 *   متغيرات اختيارية: FRONTEND_URL, API_URL
 */
const FRONTEND = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
const API = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const TAG = Math.random().toString(16).slice(2, 8);

const results = [];
const secrets = [];

function redact(s) {
  let out = String(s);
  for (const v of secrets) if (v) out = out.split(v).join("***");
  return out;
}

function step(name, ok, info = "") {
  results.push(Boolean(ok));
  console.log(`${ok ? "✅" : "❌"} ${name}${info ? ` — ${redact(info)}` : ""}`);
  return Boolean(ok);
}

function credentials() {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    console.error("❌ عيّن E2E_EMAIL و E2E_PASSWORD، أو شغّل من مجلد backend:  .venv\Scripts\python.exe e2e_run.py");
    process.exit(1);
  }
  secrets.push(password);
  return { email, password };
}

let token = null;

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Origin: FRONTEND, // نفس أصل الواجهة (يفحص CORS أيضاً)
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ليس JSON */
  }
  return { status: res.status, data, cors: res.headers.get("access-control-allow-origin") };
}

const info = (r) => `HTTP ${r.status}${r.data?.detail ? `: ${typeof r.data.detail === "string" ? r.data.detail : JSON.stringify(r.data.detail)}` : ""}`;

async function fetchPage(path, lang) {
  const res = await fetch(`${FRONTEND}${path}`, { redirect: "manual", headers: lang ? { Cookie: `daiah.lang=${lang}` } : {} });
  return { status: res.status, html: await res.text() };
}

async function checkPage(path, { lang = "ar", status = 200, contains, skipDir = false } = {}) {
  const cookie = lang === "en" || path.startsWith("/admin") ? lang : undefined;
  const label = `صفحة ${path}${lang === "en" ? " (English)" : ""}`;
  try {
    const r = await fetchPage(path, cookie);
    const want = lang === "en" && !path.startsWith("/admin") ? /<html[^>]*lang="en"[^>]*dir="ltr"/ : /<html[^>]*lang="ar"[^>]*dir="rtl"/;
    const okDir = skipDir || want.test(r.html);
    const okText = !contains || r.html.includes(contains);
    return step(label, r.status === status && okDir && okText,
      `HTTP ${r.status}${okDir ? "" : " (lang/dir غير صحيح)"}${okText ? "" : " (النص غير موجود)"}`);
  } catch (e) {
    return step(label, false, e.message);
  }
}

const PUBLIC_PAGES = ["/", "/assistant", "/library", "/shubuhat", "/intro", "/new-muslim"];
const STATIC_PAGES = [
  ...PUBLIC_PAGES,
  "/design-system",
  "/admin/login",
  "/admin",
  "/admin/sections",
  "/admin/posts",
  "/admin/posts/new",
  "/admin/posts/import",
  "/admin/review",
  "/admin/ai/settings",
  "/admin/ai/knowledge",
  "/admin/ai/lab",
  "/admin/ai/unanswered",
  "/admin/centers",
  "/admin/account",
];

// مادة تجريبية محايدة (ليست محتوى شرعياً)
const POST = {
  title_ar: `العناية بنبات الصبار المنزلي ${TAG}`,
  title_en: `Caring for a Home Cactus ${TAG}`,
  content_ar:
    "<h2>الإضاءة</h2><p>يحتاج نبات الصبار إلى ضوء شمس غير مباشر وقوي لعدة ساعات يومياً، لذلك ضعه قرب نافذة مشمسة.</p>" +
    "<h2>الري</h2><p>اسقِ الصبار مرة كل أسبوعين في الصيف، ومرة واحدة كل شهر في الشتاء، واترك التربة تجف تماماً بين كل ريّة وأخرى.</p>" +
    "<ul><li>استخدم أصيصاً فيه ثقوب تصريف.</li><li>اختر تربة رملية خاصة بالصبار.</li></ul>" +
    // لفحص التنظيف في الخادم: يجب أن يُحذف السكربت ومعالج onerror من HTML الصفحة
    '<p>نهاية المادة<img src="x" onerror="window.__xss_e2e=1"></p><script>window.__xss_e2e=2</script>',
  content_en:
    "<p>Cactus plants need bright indirect sunlight. Water them every two weeks in summer and once a month in winter, letting the soil dry out completely.</p>",
  summary_ar: "دليل مبسط للعناية بالصبار في المنزل.",
  tags: ["اختبار", "e2e"],
  topic: "اختبار آلي",
  source_name: "بيانات اختبار e2e",
  external_ref: "https://example.com/e2e",
  content_type: "article",
};
const QUESTION = "كم مرة أسقي نبات الصبار في الشتاء؟";
const FAR_QUESTION = "ما هي عاصمة أستراليا؟";
const SESSION = process.env.E2E_SESSION || `e2e-${TAG}`;

async function scenario() {
  const created = { section: null, post: null };
  const { email, password } = credentials();

  let r = await call("POST", "/api/auth/login", { email, password: "wrong-password" });
  step("دخول بكلمة مرور خاطئة يُرفض", r.status === 401, info(r));
  r = await call("POST", "/api/auth/login", { email, password });
  if (!step("تسجيل الدخول", r.status === 200 && r.data?.access_token, r.status === 200 ? "" : info(r))) return created;
  token = r.data.access_token;
  step("CORS يسمح لأصل الواجهة", r.cors === FRONTEND || r.cors === "*", `allow-origin=${r.cors}`);

  r = await call("GET", "/api/auth/me");
  step("GET /api/auth/me", r.status === 200 && r.data?.role === "admin", info(r));

  for (const p of [
    "/api/admin/dashboard/stats",
    "/api/admin/dashboard/activity",
    "/api/admin/dashboard/system-status",
    "/api/admin/ai/settings",
    "/api/admin/ai/settings/history",
    "/api/admin/ai/unanswered?limit=5",
    "/api/admin/referral-centers",
  ]) {
    r = await call("GET", p);
    step(`GET ${p}`, r.status === 200, info(r));
  }

  try {
    // 1) إنشاء قسم
    r = await call("POST", "/api/admin/sections", {
      name_ar: `قسم اختبار e2e ${TAG}`,
      name_en: `E2E Section ${TAG}`,
      category: "methodology",
      description: "قسم مؤقت يُحذف بعد الاختبار",
      sort_order: 999,
      is_active: true,
    });
    if (!step("إنشاء قسم", r.status === 201, info(r))) return created;
    created.section = r.data.id;

    // 2) إنشاء منشور (مسودة)
    r = await call("POST", "/api/admin/posts", { ...POST, section_id: created.section, status: "draft" });
    if (!step("إنشاء منشور (مسودة)", r.status === 201 && r.data?.status === "draft", info(r))) return created;
    created.post = r.data.id;
    const id = created.post;

    r = await call("GET", `/api/admin/posts/${id}`);
    step("المحرر: GET /api/admin/posts/{id}", r.status === 200 && r.data?.content_ar === POST.content_ar && r.data?.created_by_name, info(r));

    // 3) إرسال للمراجعة ثم ظهوره في صفحة المراجعة
    r = await call("PUT", `/api/admin/posts/${id}`, { status: "review" });
    step("إرسال للمراجعة", r.status === 200 && r.data?.status === "review", info(r));
    r = await call("GET", `/api/admin/posts?status=review&section_id=${created.section}`);
    step("يظهر في المراجعة (status=review)", r.status === 200 && r.data?.items?.some((p) => p.id === id), info(r));

    // 4) النشر (من شاشة المراجعة: اعتماد ونشر)
    r = await call("POST", `/api/admin/posts/${id}/publish`);
    step(
      "اعتماد ونشر + فهرسة",
      r.status === 200 && r.data?.status === "published" && r.data?.indexed && r.data?.chunks > 0,
      r.status === 200 ? `chunks=${r.data.chunks}${r.data.index_warning ? `, warning=${r.data.index_warning}` : ""}` : info(r),
    );

    // 5) ظهوره مفهرساً في قاعدة المعرفة
    r = await call("GET", "/api/admin/ai/index-status");
    const item = r.data?.items?.find((i) => i.post_id === id);
    step("قاعدة المعرفة: الحالة indexed", r.status === 200 && item?.state === "indexed" && item.chunks_ar > 0 && item.chunks_en > 0,
      item ? `state=${item.state}, ar=${item.chunks_ar}, en=${item.chunks_en}` : info(r));

    // 6) المختبر
    r = await call("POST", "/api/admin/ai/test", { message: QUESTION, lang: "ar" });
    const lab = r.data;
    const top = lab?.results?.[0];
    step(
      "المختبر: decision=match بالمنشور الصحيح",
      r.status === 200 && lab?.decision === "match" && lab?.preview?.post?.id === id,
      r.status === 200 ? `top=${top?.similarity?.toFixed?.(4)} (العتبة ${lab?.threshold}), category=${lab?.classification?.category}` : info(r),
    );
    if (lab?.preview?.type === "match") {
      step("المختبر: النص المعروض = content_ar حرفياً", lab.preview.post.content === POST.content_ar);
      step("المختبر: جملة توجيه قصيرة", typeof lab.preview.guidance === "string" && lab.preview.guidance.split(/\s+/).length <= 30, lab.preview.guidance);
      step("المختبر: النتائج بدرجاتها و above_threshold", lab.results.every((x) => typeof x.similarity === "number" && typeof x.above_threshold === "boolean"));
    }
    r = await call("POST", "/api/admin/ai/test", { message: QUESTION, lang: "en" });
    step(
      "المختبر (English): match + content_en حرفياً",
      r.status === 200 && r.data?.preview?.type === "match" && r.data.preview.post.content === POST.content_en,
      r.status === 200 ? `decision=${r.data?.decision}` : info(r),
    );

    // صفحات المحرر والمراجعة الديناميكية
    await checkPage(`/admin/posts/${id}`);
    await checkPage(`/admin/review/${id}`);

    // 7) الموقع العام: المكتبة ← صفحة المادة ← المساعد
    const slug = (await call("GET", `/api/admin/posts/${id}`)).data?.slug;
    r = await call("GET", `/api/posts?q=${encodeURIComponent(TAG)}`);
    step("المكتبة (API): المنشور يظهر", r.status === 200 && r.data?.items?.some((p) => p.slug === slug && p.reading_minutes >= 1), info(r));
    await checkPage(`/library?q=${encodeURIComponent(TAG)}`, { contains: POST.title_ar });
    r = await call("GET", `/api/posts/${slug}`);
    step("صفحة المادة (API): النص حرفياً", r.status === 200 && r.data?.content_ar === POST.content_ar && r.data?.content_en === POST.content_en, info(r));
    step("صفحة المادة: اسم المراجع (reviewed_by_name)", typeof r.data?.reviewed_by_name === "string" && r.data.reviewed_by_name.length > 0, String(r.data?.reviewed_by_name));
    await checkPage(`/posts/${slug}`, { contains: POST.title_ar });
    try {
      const page = (await fetchPage(`/posts/${slug}`)).html;
      const body = page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
      const missing = ["اترك التربة تجف تماماً", "نهاية المادة", ">الري</h2>"].filter((x) => !body.includes(x));
      step("صفحة المادة: النص كاملاً في HTML الخادم (منظّفاً بـ DOMPurify)", missing.length === 0,
        missing.length ? `غير موجود: ${missing.join(" | ")} — ${(body.match(/prose-content[^>]*>.{0,160}/) || ["(لا prose-content)"])[0]}` : "");
      // بيانات RSC داخل سكربتات Next تحمل النص الخام كسلسلة (غير منفَّذة)، فنفحص الوسوم المرسومة فقط
      const markup = page.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, (m) => (m.includes("__xss_e2e=2") && !m.includes("self.__next_f") ? "INJECTED" : ""));
      step("صفحة المادة: الخادم حذف السكربت ومعالج onerror",
        !markup.includes("INJECTED") && !/onerror\s*=/i.test(markup) && !markup.includes("__xss_e2e"));
    } catch (e) {
      step("صفحة المادة: النص كاملاً في HTML الخادم", false, e.message);
    }
    await checkPage(`/posts/${slug}`, { lang: "en", contains: POST.title_en });
    r = await call("GET", `/api/posts/${slug}/related`);
    step("مواد ذات صلة (API)", r.status === 200 && Array.isArray(r.data) && !r.data.some((p) => p.slug === slug), info(r));

    r = await call("POST", "/api/chat", { message: QUESTION, lang: "ar", session_id: SESSION });
    step(
      "المساعد /api/chat: match بالمنشور الصحيح",
      r.status === 200 && r.data?.type === "match" && r.data?.post?.id === id,
      r.status === 200 ? `type=${r.data?.type}, threshold=${r.data?.threshold}` : info(r),
    );
    if (r.data?.type === "match") {
      step("المساعد: النص = content_ar حرفياً", r.data.post.content === POST.content_ar);
      step("المساعد: المصادر بدرجاتها + العتبة + log_id",
        Array.isArray(r.data.sources) && r.data.sources.every((x) => typeof x.similarity === "number") && typeof r.data.threshold === "number" && r.data.log_id > 0);
      const fb = await call("POST", "/api/chat/feedback", { log_id: r.data.log_id, helpful: true });
      step("المساعد: تقييم «مفيد»", fb.status === 200, info(fb));
    }
    r = await call("POST", "/api/chat", { message: QUESTION, lang: "en", session_id: SESSION });
    step("المساعد (English): content_en حرفياً", r.status === 200 && r.data?.type === "match" && r.data.post.content === POST.content_en, info(r));
    r = await call("POST", "/api/chat", { message: FAR_QUESTION, lang: "ar", session_id: SESSION });
    step(
      "المساعد: سؤال بعيد ← fallback مع المراكز والعتبة",
      r.status === 200 && r.data?.type === "fallback" && Array.isArray(r.data?.referrals) && typeof r.data?.threshold === "number" && !r.data?.post,
      r.status === 200 ? `type=${r.data?.type}` : info(r),
    );

    // 9) الأسئلة المقترحة: من اللوحة ← المسار العام ← الرئيسية والمساعد (ثم القائمة الأصلية)
    const orig = (await call("GET", "/api/admin/ai/settings")).data?.suggested_questions ?? [];
    try {
      r = await call("PUT", "/api/admin/ai/settings", { suggested_questions: [QUESTION] });
      step("اللوحة: حفظ سؤال مقترح", r.status === 200 && r.data?.suggested_questions?.[0] === QUESTION, info(r));
      r = await call("GET", "/api/public/suggested-questions");
      step("المسار العام: يرجع السؤال فوراً", r.status === 200 && r.data?.questions?.[0] === QUESTION, info(r));
      await checkPage("/", { contains: QUESTION });
      await checkPage("/assistant", { contains: QUESTION });
      await checkPage(`/admin/ai/lab?q=${encodeURIComponent(QUESTION)}`);
      r = await call("PUT", "/api/admin/ai/settings", { suggested_questions: [] });
      const home = (await fetchPage("/")).html;
      step("قائمة فارغة: لا يظهر أي سؤال مقترح في الرئيسية", r.status === 200 && !home.includes(QUESTION));
    } finally {
      r = await call("PUT", "/api/admin/ai/settings", { suggested_questions: orig });
      step("استعادة الأسئلة المقترحة الأصلية", r.status === 200, info(r));
    }
  } finally {
    // 8) الحذف
    if (created.post) {
      r = await call("DELETE", `/api/admin/posts/${created.post}`);
      step("حذف المنشور", r.status === 200, info(r));
      r = await call("GET", `/api/admin/posts/${created.post}`);
      step("المنشور لم يعد موجوداً", r.status === 404, info(r));
      r = await call("GET", "/api/admin/ai/index-status");
      step("ومقاطعه حُذفت من الفهرس", r.status === 200 && !r.data?.items?.some((i) => i.post_id === created.post), info(r));
      r = await call("GET", `/api/posts?q=${encodeURIComponent(TAG)}`);
      step("ولم يعد في المكتبة", r.status === 200 && r.data?.total === 0, info(r));
    }
    if (created.section) {
      r = await call("DELETE", `/api/admin/sections/${created.section}`);
      step("حذف القسم", r.status === 200, info(r));
    }
  }
  return created;
}

async function main() {
  console.log(`الواجهة: ${FRONTEND} · الـ API: ${API}\n`);
  try {
    const h = await fetch(`${API}/api/health`);
    if (!step("الـ Backend يعمل (/api/health)", h.ok, `HTTP ${h.status}`)) process.exit(1);
  } catch (e) {
    step("الـ Backend يعمل (/api/health)", false, e.message);
    process.exit(1);
  }

  console.log("\n— الصفحات —");
  for (const p of STATIC_PAGES) await checkPage(p);
  for (const p of PUBLIC_PAGES) await checkPage(p, { lang: "en" });
  await checkPage("/admin/login", { lang: "en" }); // اللوحة تبقى عربية حتى مع كوكي الإنجليزية
  await checkPage(`/no-such-page-${TAG}`, { status: 404 });
  // notFound() داخل الصفحة: Next يرسل غلافاً مبسطاً ثم يرسم 404 بالهوية نفسها (lang/dir يضبطها العميل)
  await checkPage(`/posts/no-such-post-${TAG}`, { status: 404, skipDir: true, contains: "الصفحة غير موجودة" });

  // قاعدة بلا محتوى (كما بعد النشر مباشرة): حالات فارغة واضحة + المساعد يرجع fallback مفهوماً
  const total = (await call("GET", "/api/posts?page_size=1")).data?.total;
  if (total === 0) {
    console.log("\n— القاعدة فارغة من المحتوى —");
    const EMPTY = [
      ["/", "ar", "لا توجد مواد منشورة بعد"], ["/", "en", "No published materials yet"],
      ["/library", "ar", "لا توجد مواد منشورة بعد"], ["/library", "en", "No published materials yet"],
      ["/shubuhat", "ar", "لا توجد ردود منشورة بعد"], ["/shubuhat", "en", "No published responses yet"],
      ["/intro", "ar", "لم تُنشر مواد تعريفية بعد"], ["/intro", "en", "No introductory materials published yet"],
      ["/new-muslim", "ar", "لم تُضف مواد هذا المسار بعد"], ["/new-muslim", "en", "This path has no materials yet"],
    ];
    for (const [path, lang, text] of EMPTY) await checkPage(path, { lang, contains: text });
    const r = await call("POST", "/api/chat", { message: QUESTION, lang: "ar", session_id: SESSION });
    step("قاعدة فارغة: المساعد يرجع fallback برسالة وبدون مادة",
      r.status === 200 && r.data?.type === "fallback" && !r.data?.post && typeof r.data?.message === "string" && r.data.message.length > 10,
      r.status === 200 ? `type=${r.data?.type}` : info(r));
  } else {
    console.log(`\n(تخطي فحص القاعدة الفارغة: فيها ${total ?? "?"} منشوراً)`);
  }

  console.log("\n— السيناريو عبر الـ API —");
  await scenario();

  const passed = results.filter(Boolean).length;
  console.log(`\n${passed === results.length ? "🎉" : "⚠️ "} ${passed}/${results.length} خطوة نجحت`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error("❌", redact(e?.stack || e));
  process.exit(1);
});
