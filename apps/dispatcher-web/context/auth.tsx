"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Fetch our own API routes with the session Bearer token attached. */
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>;
}

// Set just before signing out an expired session; the login page reads it to
// explain why the user landed there (sessionStorage survives the redirect).
export const SESSION_EXPIRED_KEY = "gepeto.sessionExpired";

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
  apiFetch: async () => { throw new Error("AuthProvider not mounted"); },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const expiring = useRef(false);
  // One shared refresh for every request that hits a 401 at the same moment.
  // Pages fire several requests at once; without this each started its own
  // refresh, every refresh re-set the session, and pages reloaded in a burst.
  const refreshing = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // A fresh sign-in re-arms expiry handling (see expireSession).
      if (session) expiring.current = false;
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabaseBrowser.auth.signOut();
  };

  const request = (path: string, init: RequestInit | undefined, token: string | undefined) =>
    fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token ?? ""}`,
        ...(init?.headers ?? {}),
      },
    });

  // A stale session used to fail silently: every API call came back 401 and
  // pages just sat empty. Now a 401 triggers one refresh-and-retry; if the
  // session can't be renewed, sign out so AppShell's guard sends the user to
  // /login, where the expired-session note explains what happened.
  const expireSession = async () => {
    if (expiring.current) return;
    expiring.current = true;
    try {
      sessionStorage.setItem(SESSION_EXPIRED_KEY, "1");
    } catch {}
    await supabaseBrowser.auth.signOut({ scope: "local" }).catch(() => {});
    setSession(null);
    // Stays latched until the next sign-in, so other requests that were in
    // flight with the dead session don't re-raise the note after /login has
    // already shown and cleared it.
  };

  const apiFetch = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const { data: { session: current } } = await supabaseBrowser.auth.getSession();
    let res = await request(path, init, current?.access_token);

    if (res.status === 401 && current) {
      if (!refreshing.current) {
        refreshing.current = supabaseBrowser.auth
          .refreshSession()
          .then(({ data, error }) => (error ? null : data.session?.access_token ?? null))
          .catch(() => null)
          .finally(() => setTimeout(() => { refreshing.current = null; }, 5_000));
      }
      const token = await refreshing.current;
      if (token) res = await request(path, init, token);
      if (res.status === 401) await expireSession();
    }

    return res.json() as Promise<T>;
  };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
