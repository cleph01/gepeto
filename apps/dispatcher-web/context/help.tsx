"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import type { HelpArticle, HelpManual } from "@/lib/help/types";

type HelpState = {
  manual: HelpManual | null;
  failed: boolean;
  retry: () => void;
};

const HelpContext = createContext<HelpState>({ manual: null, failed: false, retry: () => {} });

// Loads the manual once for all of /help.
export function HelpProvider({ children }: { children: React.ReactNode }) {
  const { session, apiFetch } = useAuth();
  const [manual, setManual] = useState<HelpManual | null>(null);
  const [failed, setFailed] = useState(false);
  const signedIn = !!session;

  const load = useCallback(() => {
    apiFetch<{ data: HelpManual | null }>("/api/help")
      .then((res) => {
        if (res.data) setManual(res.data);
        else setFailed(true);
      })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  const retry = () => {
    setFailed(false);
    load();
  };

  return <HelpContext.Provider value={{ manual, failed, retry }}>{children}</HelpContext.Provider>;
}

export const useHelp = () => useContext(HelpContext);

export function allArticles(manual: HelpManual): HelpArticle[] {
  return manual.sections.flatMap((section) => section.articles);
}
