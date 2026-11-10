import type { NextRequest } from "next/server";
import { ENDED_STATUSES } from "./lab-deletion";
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

// Once a subscription has ended, a lab is read-only. These writes still work:
// starting a plan again, opening billing, and marking messages read.
const ALLOWED_WHEN_READ_ONLY = [
  /^\/api\/billing\/(portal|restart)$/,
  /^\/api\/(jobs|returns)\/[^/]+\/messages\/read$/,
  /^\/api\/direct-messages\/offices\/[^/]+\/read$/,
];

// Every write in the API comes through requireAuth, so this is the one place
// that enforces it. Failed payments don't count: Stripe is still retrying the
// card, and one bad card shouldn't stop a lab's deliveries.
async function blockIfReadOnly(request: NextRequest, user: AuthUser) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const path = request.nextUrl.pathname;
  if (ALLOWED_WHEN_READ_ONLY.some((allowed) => allowed.test(path))) return;

  const lab = await db("labs").where({ id: user.labId }).select("subscription_status").first();
  if (!lab?.subscriptionStatus || !ENDED_STATUSES.includes(lab.subscriptionStatus)) return;

  // A driver's phone stops tracking when told there's nothing to share.
  if (path === "/api/drivers/location" && user.driverId) {
    await db("drivers").where({ id: user.driverId, lab_id: user.labId }).update({ current_location: null });
    throw Response.json({ data: { location: null }, error: null });
  }
  throw Response.json(
    { data: null, error: { code: "READ_ONLY", message: "Your lab's subscription has ended, so Gepeto is read-only. The lab owner can start a plan in Settings." } },
    { status: 403 }
  );
}

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
      const fallback: AuthUser = { id: data.user.id, role: "dispatcher", labId: labUser.labId, labRole: labUser.labRole };
      await blockIfReadOnly(request, fallback);
      return fallback;
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

  await blockIfReadOnly(request, user);
  return user;
}
