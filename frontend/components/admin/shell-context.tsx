"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { DashboardStats, SystemStatus } from "@/lib/types";
import type { CounterKey } from "./nav";

interface ShellContextValue {
  counts: Partial<Record<CounterKey, number>>;
  stats: DashboardStats | undefined;
  system: SystemStatus | undefined;
  systemError: boolean;
  /** يُستدعى بعد أي عملية تغيّر العدّادات (نشر، مراجعة…) */
  refreshCounts: () => void;
  refreshSystem: (force?: boolean) => Promise<void>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<DashboardStats>();
  const [system, setSystem] = useState<SystemStatus>();
  const [systemError, setSystemError] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    api<DashboardStats>("/api/admin/dashboard/stats", { signal: ctrl.signal })
      .then(setStats)
      .catch(() => {
        /* العدّادات اختيارية */
      });
    return () => ctrl.abort();
  }, [nonce]);

  const refreshSystem = useCallback(async (force = false) => {
    try {
      const s = await api<SystemStatus>("/api/admin/dashboard/system-status", { query: { refresh: force || undefined } });
      setSystem(s);
      setSystemError(false);
    } catch {
      setSystemError(true);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refreshSystem());
    const t = setInterval(() => void refreshSystem(), 120_000);
    return () => clearInterval(t);
  }, [refreshSystem]);

  const refreshCounts = useCallback(() => setNonce((n) => n + 1), []);

  const value = useMemo<ShellContextValue>(
    () => ({
      counts: stats ? { review: stats.posts_by_status.review, unanswered: stats.unanswered_questions } : {},
      stats,
      system,
      systemError,
      refreshCounts,
      refreshSystem,
    }),
    [stats, system, systemError, refreshCounts, refreshSystem],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell يجب أن يُستخدم داخل ShellProvider");
  return ctx;
}
