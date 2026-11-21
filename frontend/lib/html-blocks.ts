/**
 * نص المادة ككتل نصية بسيطة (فقرة/عنوان/عنصر قائمة/اقتباس) لعرضه في HTML الخادم قبل التحميل:
 * يظهر النص فوراً (LCP وSEO) بنفس التخطيط تقريباً، ثم يستبدله SafeHtml بالـ HTML المنظّف بـ DOMPurify.
 *
 * آمن بالتركيب: الناتج نصوص فقط تُعرض عبر React (مُهرَّبة)، ولا يُمرَّر أي HTML خام.
 * الحروف كما هي في المادة (حذف الوسوم وفك الكيانات فقط) — لا تعديل على المحتوى.
 */
export type BlockTag = "p" | "h2" | "h3" | "h4" | "li" | "blockquote";
export interface TextBlock {
  tag: BlockTag;
  text: string;
  id?: string;
}

const BLOCK_MAP: Record<string, BlockTag> = {
  p: "p", div: "p", h1: "h2", h2: "h2", h3: "h3", h4: "h4", h5: "h4", h6: "h4", li: "li", blockquote: "blockquote",
  pre: "p", td: "p", th: "p",
};
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function htmlToBlocks(html: string | null | undefined, max = 400): TextBlock[] {
  if (!html) return [];
  const src = html.replace(/<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const out: TextBlock[] = [];
  let tag: BlockTag = "p";
  let id: string | undefined;
  let buf = "";
  const flush = () => {
    const text = decode(buf).replace(/[ \t\r\f\v ]+/g, " ").replace(/ *\n */g, "\n").trim();
    if (text && out.length < max) out.push(id ? { tag, text, id } : { tag, text });
    buf = "";
  };
  const re = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[4] !== undefined || m[0] === "<") {
      buf += m[4] ?? "<";
      continue;
    }
    const name = m[2].toLowerCase();
    if (name === "br") {
      buf += "\n";
      continue;
    }
    const block = BLOCK_MAP[name];
    if (!block) continue; // وسوم سطرية (b, a, span…) تُحذف ويبقى نصها
    flush();
    if (m[1]) {
      tag = "p";
      id = undefined;
    } else {
      tag = block;
      id = /\bid\s*=\s*"([A-Za-z0-9_-]{1,40})"/.exec(m[3])?.[1];
    }
  }
  flush();
  return out;
}
