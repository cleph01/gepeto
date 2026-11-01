import { createClient } from "@supabase/supabase-js";

// Signed links to proof-of-delivery photos in the private "pod-photos"
// bucket. Same as signPodPhoto in the dispatcher's lib/pod-photos.ts.
// Server-side only: uses the service key.
const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

export async function signPodPhoto(path: string, expiresIn = 300): Promise<string | null> {
  const { data } = await admin.storage.from("pod-photos").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
