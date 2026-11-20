"use client";

import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/overlays";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  id: string;
  /** القيمة الابتدائية فقط (المحرر يُعاد إنشاؤه عبر key عند تحميل منشور آخر) */
  initialValue: string;
  onChange: (html: string) => void;
  dir: "rtl" | "ltr";
  lang: "ar" | "en";
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}

/** محرر نصوص غني (TipTap) يدعم RTL: عناوين، قوائم، اقتباس، رابط، غامق. */
export function RichTextEditor({
  id,
  initialValue,
  onChange,
  dir,
  lang,
  placeholder,
  invalid,
  describedBy,
}: RichTextEditorProps) {
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: initialValue || "",
    editorProps: {
      attributes: {
        id,
        dir,
        lang,
        role: "textbox",
        "aria-multiline": "true",
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        class: "tiptap prose-content px-4 py-3 text-body",
      },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.isEmpty ? "" : editor.getHTML()),
  });

  return (
    <div
      className={cn(
        "overflow-hidden rounded-sm border bg-surface transition-[border-color,box-shadow] duration-150 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500",
        invalid ? "border-danger" : "border-border",
      )}
    >
      {editor ? <Toolbar editor={editor} /> : <div className="h-11 border-b border-border bg-surface-muted" />}
      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="min-h-[280px] px-4 py-3 text-text-muted" aria-hidden>
          …
        </div>
      )}
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      href: (e.getAttributes("link").href as string | undefined) ?? "",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  return (
    <div
      role="toolbar"
      aria-label="أدوات التنسيق"
      className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-muted/60 px-1.5 py-1"
    >
      <ToolButton label="عنوان رئيسي" active={s.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 />
      </ToolButton>
      <ToolButton label="عنوان فرعي" active={s.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 />
      </ToolButton>
      <Sep />
      <ToolButton label="غامق" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label="مائل" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <Sep />
      <ToolButton label="قائمة نقطية" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List />
      </ToolButton>
      <ToolButton label="قائمة مرقمة" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered />
      </ToolButton>
      <ToolButton label="اقتباس" active={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote />
      </ToolButton>
      <Sep />
      <LinkButton editor={editor} active={s.link} currentHref={s.href} />
      {s.link && (
        <ToolButton label="إزالة الرابط" onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}>
          <Link2Off />
        </ToolButton>
      )}
      <div className="ms-auto flex items-center gap-0.5">
        <ToolButton label="تراجع" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="rtl:-scale-x-100" />
        </ToolButton>
        <ToolButton label="إعادة" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="rtl:-scale-x-100" />
        </ToolButton>
      </div>
    </div>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "grid size-9 place-items-center rounded-sm text-text-secondary transition-colors duration-150 hover:bg-surface hover:text-text disabled:opacity-40 [&_svg]:size-4",
        active && "bg-primary-100 text-primary-700 hover:bg-primary-100",
      )}
    >
      {children}
    </button>
  );
}

function LinkButton({ editor, active, currentHref }: { editor: Editor; active: boolean; currentHref: string }) {
  const [url, setUrl] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const apply = () => {
    const v = url.trim();
    if (!v) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const href = /^(https?:|mailto:)/i.test(v) ? v : `https://${v}`;
      if (editor.state.selection.empty && !active) {
        editor.chain().focus().insertContent({ type: "text", text: v, marks: [{ type: "link", attrs: { href } }] }).run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      }
    }
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUrl(currentHref);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="إدراج رابط"
          title="إدراج رابط"
          aria-pressed={active}
          className={cn(
            "grid size-9 place-items-center rounded-sm text-text-secondary transition-colors duration-150 hover:bg-surface hover:text-text [&_svg]:size-4",
            active && "bg-primary-100 text-primary-700",
          )}
        >
          <Link2 />
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          className="flex flex-col gap-2"
        >
          <label htmlFor="rte-link" className="text-sm font-medium">
            الرابط
          </label>
          <Input id="rte-link" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" autoFocus />
          <div className="flex justify-end gap-2">
            <PopoverClose asChild>
              <Button variant="ghost" size="sm">
                إلغاء
              </Button>
            </PopoverClose>
            <Button type="submit" size="sm">
              تطبيق
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
