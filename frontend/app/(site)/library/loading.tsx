import { PostCardSkeleton } from "@/components/site/cards";

/** Skeleton عام للموقع أثناء جلب البيانات من الخادم. */
export default function Loading() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-7 px-4 pb-24 pt-10 md:px-8" aria-busy="true">
      <div className="h-10 w-1/3 animate-pulse rounded-sm bg-surface-muted" />
      <div className="h-5 w-1/2 animate-pulse rounded-sm bg-surface-muted" />
      <div className="h-14 w-full animate-pulse rounded-lg bg-surface-muted" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-5">
        {Array.from({ length: 6 }, (_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
