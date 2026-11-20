"use client";

import { useEffect } from "react";

/** لوحة التحكم عربية دائماً، حتى بعد تنقل من جهة العميل قادم من موقع بالإنجليزية. */
export function ForceArabic() {
  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  }, []);
  return null;
}
