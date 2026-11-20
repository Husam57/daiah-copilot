"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, buildPath } from "./api";

type Query = Record<string, string | number | boolean | null | undefined>;

interface State<T> {
  key: string | null;
  data: T | undefined;
  error: ApiError | Error | undefined;
}

export interface UseApiResult<T> {
  data: T | undefined;
  error: ApiError | Error | undefined;
  /** يجلب لأول مرة (لا توجد بيانات بعد) */
  loading: boolean;
  /** يجلب (أول مرة أو تحديث بعد وجود بيانات) */
  fetching: boolean;
  reload: () => void;
  /** تعديل البيانات محلياً بعد عملية ناجحة */
  mutate: (updater: T | ((prev: T | undefined) => T)) => void;
}

/** جلب بيانات GET مع إعادة المحاولة. path = null يعني لا تجلب. */
export function useApi<T>(path: string | null, query?: Query): UseApiResult<T> {
  const fullPath = path === null ? null : buildPath(path, query);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State<T>>({ key: null, data: undefined, error: undefined });
  const requestKey = fullPath === null ? null : `${fullPath}#${nonce}`;

  useEffect(() => {
    if (fullPath === null || requestKey === null) return;
    const ctrl = new AbortController();
    api<T>(fullPath, { signal: ctrl.signal })
      .then((data) => setState({ key: requestKey, data, error: undefined }))
      .catch((error) => {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ key: requestKey, data: s.data, error }));
      });
    return () => ctrl.abort();
  }, [fullPath, requestKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const mutate = useCallback((updater: T | ((prev: T | undefined) => T)) => {
    setState((s) => ({
      ...s,
      data: typeof updater === "function" ? (updater as (p: T | undefined) => T)(s.data) : updater,
    }));
  }, []);

  const fetching = requestKey !== null && state.key !== requestKey;
  return {
    data: state.data,
    error: fetching ? undefined : state.error,
    loading: fetching && state.data === undefined,
    fetching,
    reload,
    mutate,
  };
}

/** قيمة مؤجلة (للبحث أثناء الكتابة). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
