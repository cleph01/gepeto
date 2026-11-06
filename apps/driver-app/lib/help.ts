import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet } from './api';

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  related: string[];
  body: string;
};
export type HelpManual = { sections: { title: string; articles: HelpArticle[] }[] };

const CACHE_KEY = 'gepeto.help.v1';

// The guide comes from the server behind the driver's login. The last copy is
// kept on the phone, so it still opens where there's no signal.
let cached: HelpManual | null = null;
let refreshed = false;

export async function clearHelpCache() {
  cached = null;
  refreshed = false;
  await AsyncStorage.removeItem(CACHE_KEY).catch(() => {});
}

export function useHelp() {
  const [manual, setManual] = useState<HelpManual | null>(cached);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!cached) {
      const saved = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
      if (saved) {
        try {
          cached = JSON.parse(saved) as HelpManual;
          setManual(cached);
        } catch {
          // A bad saved copy is replaced by the fetch below.
        }
      }
    }
    if (refreshed) return;
    try {
      const res = await apiGet<HelpManual>('/api/help');
      if (!res.data) throw new Error('No guide returned');
      cached = res.data;
      refreshed = true;
      setManual(res.data);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(res.data)).catch(() => {});
    } catch {
      if (!cached) setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const retry = useCallback(() => {
    setFailed(false);
    load();
  }, [load]);

  return { manual, failed, retry };
}

export function allArticles(manual: HelpManual) {
  return manual.sections.flatMap((section) => section.articles);
}
