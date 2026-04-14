import type { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase";

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

  const meta = data.user.user_metadata as Record<string, unknown>;
  const role = meta.role as string;
  const labId = meta.lab_id as string;

  if ((role !== "dispatcher" && role !== "driver") || !labId) {
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
