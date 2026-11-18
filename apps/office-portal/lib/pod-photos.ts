import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Signed links to proof-of-delivery photos in the private "pod-photos"
// bucket. Same as signPodPhoto in the dispatcher's lib/pod-photos.ts.
// Server-side only: uses the service key.
//
// The client is created on first use, not at import, so `next build` can
// load this module without Supabase env vars (e.g. Vercel preview builds).
let admin: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (!admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return admin;
}

export async function signPodPhoto(path: string, expiresIn = 300): Promise<string | null> {
  const { data } = await getAdmin().storage.from("pod-photos").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
