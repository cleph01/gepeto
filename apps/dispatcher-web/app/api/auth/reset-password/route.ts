import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getDashboardUrl, sendPasswordResetEmail } from "@/lib/email";

// POST /api/auth/reset-password — public route for the forgot-password page.
// Generates a recovery link via Supabase admin (no email sent by Supabase) and
// delivers it through Resend. Always returns success to prevent email enumeration.
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email?.trim()) {
      return Response.json({ error: { message: "Email is required" } }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: { redirectTo: `${getDashboardUrl()}/accept-invite` },
    });

    // Don't reveal whether the email exists — just log and return success.
    if (linkError || !linkData?.properties?.action_link) {
      if (linkError) console.error("[POST /api/auth/reset-password] generateLink failed:", linkError.message);
      return Response.json({ error: null });
    }

    await sendPasswordResetEmail(normalizedEmail, {
      resetUrl: linkData.properties.action_link,
      isReset: true,
    }).catch((err) => console.error("[POST /api/auth/reset-password] Resend failed:", err));

    return Response.json({ error: null });
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err);
    // Still return success to prevent enumeration
    return Response.json({ error: null });
  }
}
