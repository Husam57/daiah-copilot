"use client";

import { FileX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EditorSkeleton, PostEditor } from "@/components/admin/post-editor";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { ApiError } from "@/lib/api";
import type { Post, Section } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const valid = /^\d+$/.test(id);
  const post = useApi<Post>(valid ? `/api/admin/posts/${id}` : null);
  const sections = useApi<Section[]>("/api/admin/sections");

  if (!valid || (post.error instanceof ApiError && post.error.status === 404)) {
    return (
      <Card>
        <EmptyState
          icon={<FileX />}
          title="المنشور غير موجود"
          description="ربما حُذف أو أن الرابط غير صحيح."
          action={
            <Link href="/admin/posts" className={buttonVariants({ variant: "secondary" })}>
              العودة إلى المنشورات
            </Link>
          }
        />
      </Card>
    );
  }
  const error = post.error ?? sections.error;
  if (error) {
    return (
      <Card>
        <ErrorState
          message={error.message}
          onRetry={() => {
            post.reload();
            sections.reload();
          }}
        />
      </Card>
    );
  }
  if (!post.data || !sections.data) return <EditorSkeleton />;
  return <PostEditor key={post.data.id} post={post.data} sections={sections.data} />;
}
