"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser client used only to listen for live-update broadcasts on the
// tracking page. Uses the public anon key; it never reads tables directly.
let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null; // not configured: the page falls back to polling
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
