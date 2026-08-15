import type { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

export type AuthUser = {
  id: string;
  role: "dispatcher" | "driver";
  labId: string;
  driverId?: string;
  labRole?: "owner" | "dispatcher";
};

/**
 * Extracts and verifies the Bearer token from the Authorization header.
 * Returns the authenticated user's identity or throws a Response on failure.
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(
      JSON.stringify({ data: null, error: { code: "UNAUTHORIZED", message: "Missing authorization header" } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new Response(
      JSON.stringify({ data: null, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const appMeta  = (data.user.app_metadata  ?? {}) as Record<string, unknown>;
  const userMeta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  // app_metadata is admin-controlled (Stripe webhook); user_metadata is used by the seed
  const meta  = appMeta.role ? appMeta : userMeta;
  const role  = meta.role   as string;
  const labId = meta.lab_id as string;

  // Fallback: look up the user in lab_users if metadata is missing (e.g. manually created users)
  if ((role !== "dispatcher" && role !== "driver") || !labId) {
    const labUser = await db("lab_users").where({ user_id: data.user.id }).first();
    if (labUser) {
      return { id: data.user.id, role: "dispatcher", labId: labUser.labId, labRole: labUser.labRole };
    }
    throw new Response(
      JSON.stringify({ data: null, error: { code: "FORBIDDEN", message: "Insufficient role" } }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const user: AuthUser = { id: data.user.id, role: role as AuthUser["role"], labId };

  if (role === "driver") {
    user.driverId = meta.driver_id as string;
  } else {
    user.labRole = meta.lab_role as AuthUser["labRole"];
  }

  return user;
}
