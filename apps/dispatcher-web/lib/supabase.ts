import { createClient } from "@supabase/supabase-js";

// Service-role client — server-side only, never exposed to the browser.
// Used to verify JWTs and (until RLS is in place) run queries as admin.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
