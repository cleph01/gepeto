import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { delivered, getDashboardUrl, sendPasswordResetEmail } from "@/lib/email";
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

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: member.email,
      options: { redirectTo: `${getDashboardUrl()}/accept-invite` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[POST /api/team/[id]/resend] generateLink failed:", linkError?.message);
      return Response.json(
        { data: null, error: { code: "AUTH_ERROR", message: linkError?.message ?? "Failed to generate reset link" } },
        { status: 500 }
      );
    }

    const sent = await delivered(
      sendPasswordResetEmail(member.email, { name: member.name, resetUrl: linkData.properties.action_link }),
      "[POST /api/team/[id]/resend] setup",
    );
    if (!sent) {
      return Response.json(
        { data: null, error: { code: "EMAIL_FAILED", message: "Email didn't send. Try again later." } },
        { status: 502 }
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
