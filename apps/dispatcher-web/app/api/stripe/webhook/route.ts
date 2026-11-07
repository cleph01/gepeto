import Stripe from "stripe";
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { getDashboardUrl } from "@/lib/email";
import { subscriptionEndFields } from "@/lib/lab-deletion";
import { PLANS, isExtraDriverLookupKey, parsePlanLookupKey } from "@/lib/plans";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

/**
 * POST /api/stripe/webhook
 *
 * Receives Stripe events:
 *   checkout.session.completed      provisions the lab + owner, records the plan
 *   customer.subscription.created / updated / deleted
 *                                   keeps the lab's plan, driver allowance and
 *                                   status in sync (upgrades, extra drivers,
 *                                   cancellations, failed payments, trial end)
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

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    try {
      await syncSubscription(event.data.object as Stripe.Subscription);
      return Response.json({ ok: true });
    } catch (err) {
      console.error("[webhook] subscription sync failed:", err);
      return Response.json({ error: "Sync failed" }, { status: 500 });
    }
  }

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

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

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
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      terms_version: session.metadata?.termsVersion ?? null,
      terms_accepted_at: session.metadata?.termsAcceptedAt ?? null,
      terms_accepted_by_email: session.metadata?.termsVersion ? email : null,
    });

    // 2. Invite the user via Supabase Auth — sends the invite email with a
    //    password-setup link. The user is created immediately (before acceptance).
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${getDashboardUrl()}/accept-invite`,
      });

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
      lab_role: "owner", // the column is lab_role; "role" made this insert fail
    });

    // 5. Record the plan the lab chose (from the subscription itself)
    if (subscriptionId) {
      await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId));
    }

    console.log(`[webhook] provisioned lab "${labName}" (${labId}) for ${email}`);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[webhook] provisioning failed:", err);
    // Return 500 so Stripe retries the webhook delivery
    return Response.json({ error: "Provisioning failed" }, { status: 500 });
  }
}

// Writes a subscription's plan, extra drivers and status onto its lab, found
// by Stripe customer id. Plans are recognised by price lookup key (see
// lib/plans.ts and scripts/stripe-setup.mjs).
async function syncSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const lab = await db("labs").where({ stripe_customer_id: customerId }).first();
  if (!lab) {
    // Checkout provisioning hasn't run yet; it syncs once the lab exists.
    console.log(`[webhook] no lab for customer ${customerId} yet`);
    return;
  }

  let plan: ReturnType<typeof parsePlanLookupKey> = null;
  let extraDrivers = 0;
  let periodEnd: number | null = null;
  for (const item of sub.items.data) {
    const key = item.price.lookup_key;
    const parsed = parsePlanLookupKey(key);
    if (parsed) plan = parsed;
    else if (isExtraDriverLookupKey(key)) extraDrivers += item.quantity ?? 0;
    const itemEnd = (item as unknown as { current_period_end?: number }).current_period_end;
    if (itemEnd) periodEnd = Math.max(periodEnd ?? 0, itemEnd);
  }
  const subEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (!periodEnd && subEnd) periodEnd = subEnd;

  const updates: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    extra_drivers: extraDrivers,
    trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    ...subscriptionEndFields(sub.status, sub.ended_at, lab.subscriptionEndedAt),
  };
  if (plan) {
    updates.plan = plan.plan;
    updates.billing_interval = plan.interval;
    updates.driver_limit = PLANS[plan.plan].drivers;
  } else {
    console.warn(`[webhook] subscription ${sub.id} has no recognised plan price`);
  }
  await db("labs").where({ id: lab.id }).update(updates);
  console.log(`[webhook] lab ${lab.id}: ${plan?.plan ?? "?"}/${plan?.interval ?? "?"} ${sub.status}, +${extraDrivers} drivers`);
}
