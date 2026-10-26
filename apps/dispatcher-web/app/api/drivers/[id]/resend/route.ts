import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getDashboardUrl } from "@/lib/email";
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

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(driver.email, {
      redirectTo: `${getDashboardUrl()}/accept-invite`,
    });

    if (error) {
      // Supabase's shared mailer is rate-limited (currently ~1 email/email-address
      // per short cooldown, plus a low project-wide cap on the free tier) — this
      // is expected pre-launch until Custom SMTP is set up, not a bug.
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
    console.error("[POST /api/drivers/[id]/resend]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to resend invite" } },
      { status: 500 }
    );
  }
}
