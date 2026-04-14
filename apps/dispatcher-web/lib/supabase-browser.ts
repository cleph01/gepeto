import { createClient } from "@supabase/supabase-js";

// Browser-side Supabase client (anon key) — used for auth only.
// All data fetching goes through our API routes with the session token.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
