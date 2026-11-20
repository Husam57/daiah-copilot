"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken, UNAUTHORIZED_EVENT } from "./api";
import type { TokenResponse, User } from "./types";

type AuthStatus = "loading" | "authenticated" | "guest";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** التوكن في localStorage، والمستخدم يُقرأ من /api/auth/me عند التحميل. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      queueMicrotask(() => setStatus("guest"));
      return;
    }
    const ctrl = new AbortController();
    api<User>("/api/auth/me", { signal: ctrl.signal, auth: true })
      .then((u) => {
        setUserState(u);
        setStatus("authenticated");
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        // خطأ اتصال: لا نحذف التوكن (قد يكون الخادم متوقفاً مؤقتاً)، لكن نعامله كضيف
        if (e?.status === 401) setToken(null);
        setStatus("guest");
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setUserState(null);
      setStatus("guest");
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === "daiah.token" && !e.newValue) onUnauthorized();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    setToken(res.access_token);
    setUserState(res.user);
    setStatus("authenticated");
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUserState(null);
    setStatus("guest");
  }, []);

  const setUser = useCallback((u: User) => setUserState(u), []);

  const value = useMemo(() => ({ status, user, login, logout, setUser }), [status, user, login, logout, setUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth يجب أن يُستخدم داخل AuthProvider");
  return ctx;
}
