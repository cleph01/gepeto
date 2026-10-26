import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getDashboardUrl } from "@/lib/email";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/team/[id]/resend — resend a teammate's account-setup email (owner only)
//
// See the matching driver route for why this uses resetPasswordForEmail
// rather than re-inviting: the original invite link is single-use and gets
// consumed just by opening it, independent of whether a password was ever
// set, so a stuck teammate needs a recovery-style resend instead.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher" || user.labRole !== "owner") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only the lab owner can resend invites" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const member = await db("lab_users").where({ id, lab_id: user.labId }).first();

    if (!member) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Team member not found" } },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(member.email, {
      redirectTo: `${getDashboardUrl()}/accept-invite`,
    });

    if (error) {
      const isRateLimit = error.status === 429;
      return Response.json(
        {
          data: null,
          error: {
            code: isRateLimit ? "RATE_LIMITED" : "AUTH_ERROR",
            message: isRateLimit
              ? "Too many emails sent recently. Wait a bit and try again."
              : error.message,
          },
        },
        { status: isRateLimit ? 429 : 500 }
      );
    }

    return Response.json({ data: { sent: true }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/team/[id]/resend]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to resend invite" } },
      { status: 500 }
    );
  }
}
