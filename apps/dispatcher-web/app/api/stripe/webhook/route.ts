import Stripe from "stripe";
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe events and provisions a new lab + owner account when a
 * checkout session completes.
 *
 * The raw body must be read as text before any parsing so Stripe can verify
 * the webhook signature.
 */
export async function POST(request: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set");
    return Response.json({ error: "Billing is not configured yet" }, { status: 503 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-03-25.dahlia",
  });

  const body = await request.text();
  const sig  = request.headers.get("stripe-signature");

  if (!sig) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Only act on checkout completion
  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const email   = session.metadata?.email;
  const labName = session.metadata?.labName;

  if (!email || !labName) {
    console.error("[webhook] missing metadata on session", session.id);
    return Response.json({ error: "Missing metadata" }, { status: 400 });
  }

  // Idempotency guard — skip if this email was already provisioned
  const existing = await db("lab_users").where({ email }).first();
  if (existing) {
    console.log(`[webhook] skipping duplicate provisioning for ${email}`);
    return Response.json({ ok: true });
  }

  try {
    // 1. Create the lab record
    const labId = randomUUID();
    await db("labs").insert({
      id:       labId,
      name:     labName,
      address:  "",
      phone:    "",
      settings: JSON.stringify({}),
    });

    // 2. Invite the user via Supabase Auth — sends the invite email with a
    //    password-setup link. The user is created immediately (before acceptance).
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email);

    if (inviteError) throw inviteError;
    const userId = inviteData.user.id;

    // 3. Set app_metadata so requireAuth() can read lab_id + role from the JWT
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role: "dispatcher", lab_id: labId, lab_role: "owner" },
    });

    // 4. Link the user to the lab as owner
    await db("lab_users").insert({
      id:      randomUUID(),
      lab_id:  labId,
      user_id: userId,
      name:    labName,  // placeholder — updated in Settings after first login
      email,
      role:    "owner",
    });

    console.log(`[webhook] provisioned lab "${labName}" (${labId}) for ${email}`);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[webhook] provisioning failed:", err);
    // Return 500 so Stripe retries the webhook delivery
    return Response.json({ error: "Provisioning failed" }, { status: 500 });
  }
}
