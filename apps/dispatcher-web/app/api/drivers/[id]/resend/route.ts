import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { delivered, getDashboardUrl, sendInviteEmail } from "@/lib/email";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/drivers/[id]/resend — resend the driver's account-setup email (dispatcher only)
//
// The original invite link is single-use: Supabase marks the account as
// confirmed and starts a session the moment the link is *opened*, not when
// a password is actually set, so a driver who got interrupted mid-setup
// can't just click the old link again. A password-recovery email reuses
// the same accept-invite page and works regardless of whether a password
// was ever set, so it doubles as both "resend my invite" and "I forgot my
// password" — there's no reliable "still pending" signal to tell those
// apart from Supabase's side anyway.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can resend driver invites" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const driver = await db("drivers").where({ id, lab_id: user.labId }).first();

    if (!driver) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Driver not found" } },
        { status: 404 }
      );
    }

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: driver.email,
      options: { redirectTo: `${getDashboardUrl()}/accept-invite` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error("[POST /api/drivers/[id]/resend] generateLink failed:", linkError?.message);
      return Response.json(
        { data: null, error: { code: "AUTH_ERROR", message: linkError?.message ?? "Failed to generate reset link" } },
        { status: 500 }
      );
    }

    // Same branded invite as the first one, with a fresh recovery-type link
    // (see above). Lab name only personalizes it; a failed lookup can't block it.
    const lab = await db("labs").where({ id: user.labId }).first("name").catch(() => null);
    const sent = await delivered(
      sendInviteEmail(driver.email, {
        name: driver.name,
        inviteUrl: linkData.properties.action_link,
        role: "driver",
        labName: lab?.name,
      }),
      "[POST /api/drivers/[id]/resend] setup",
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
    console.error("[POST /api/drivers/[id]/resend]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to resend invite" } },
      { status: 500 }
    );
  }
}
