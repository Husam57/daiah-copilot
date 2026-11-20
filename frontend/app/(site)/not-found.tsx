import { NotFoundBody } from "@/components/site/not-found-body";

/** 404 داخل الموقع (مادة غير منشورة مثلاً): نفس الهوية، والـ Header/Footer من layout الموقع. */
export default function SiteNotFound() {
  return (
    <div className="flex min-h-[60dvh]">
      <NotFoundBody />
    </div>
  );
}
