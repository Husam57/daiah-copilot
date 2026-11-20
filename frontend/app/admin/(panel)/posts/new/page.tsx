"use client";

import { FolderTree, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EditorSkeleton, PostEditor } from "@/components/admin/post-editor";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import type { Section } from "@/lib/types";
import { useApi } from "@/lib/use-api";

/** ?title= (من "الأسئلة غير المجابة") و ?section_id= يملآن الحقول مسبقاً. */
function readDefaults() {
  const p = new URLSearchParams(window.location.search);
  return { title_ar: p.get("title") ?? "", section_id: p.get("section_id") ?? "" };
}

export default function NewPostPage() {
  const sections = useApi<Section[]>("/api/admin/sections");
  const [defaults] = useState(readDefaults);

  if (sections.error) {
    return (
      <Card>
        <ErrorState message={sections.error.message} onRetry={sections.reload} />
      </Card>
    );
  }
  if (sections.loading || !sections.data) return <EditorSkeleton />;
  if (sections.data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<FolderTree />}
          title="أنشئ قسماً أولاً"
          description="كل منشور يجب أن ينتمي إلى قسم."
          action={
            <Link href="/admin/sections" className={buttonVariants()}>
              <Plus aria-hidden />
              إلى الأقسام
            </Link>
          }
        />
      </Card>
    );
  }
  return <PostEditor post={null} sections={sections.data} defaults={defaults} />;
}
