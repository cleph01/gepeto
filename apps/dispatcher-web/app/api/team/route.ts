import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getDashboardUrl } from "@/lib/email";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/team — list all dispatcher/owner accounts for the lab
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can view the team" } },
        { status: 403 }
      );
    }

    const team = await db("lab_users")
      .where("lab_id", user.labId)
      .orderBy("created_at", "asc")
      .select("id", "name", "email", "lab_role", "created_at");

    return Response.json({ data: team, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/team]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch team" } },
      { status: 500 }
    );
  }
}

// POST /api/team — invite a teammate (owner only)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher" || user.labRole !== "owner") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only the lab owner can invite teammates" } },
        { status: 403 }
      );
    }

    const { name, email } = await request.json();

    if (!name?.trim() || !email?.trim()) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "name and email are required" } },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await db("lab_users").where({ lab_id: user.labId, email: normalizedEmail }).first();
    if (existing) {
      return Response.json(
        { data: null, error: { code: "CONFLICT", message: "This email is already on the team" } },
        { status: 409 }
      );
    }

    // 1. Create Supabase Auth user and send invite email first — lab_users.user_id
    //    is NOT NULL, so unlike drivers (nullable user_id) we can't insert-then-backfill.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      { data: { name: name.trim() }, redirectTo: `${getDashboardUrl()}/accept-invite` }
    );

    if (authError || !authData?.user) {
      console.error("[POST /api/team] Supabase invite failed:", authError?.message);
      return Response.json(
        { data: null, error: { code: "AUTH_ERROR", message: authError?.message ?? "Failed to send invite" } },
        { status: 500 }
      );
    }

    // 2. Set app_metadata so requireAuth() and RLS policies work correctly
    await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
      app_metadata: {
        role:     "dispatcher",
        lab_id:   user.labId,
        lab_role: "dispatcher",
      },
    });

    // 3. Create the lab_users row with the Supabase user already linked
    const [labUser] = await db("lab_users")
      .insert({
        lab_id:   user.labId,
        user_id:  authData.user.id,
        name:     name.trim(),
        email:    normalizedEmail,
        lab_role: "dispatcher",
      })
      .returning("*");

    return Response.json({ data: labUser, error: null }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/team]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to invite teammate" } },
      { status: 500 }
    );
  }
}
