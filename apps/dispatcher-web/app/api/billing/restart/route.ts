import Stripe from "stripe";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ENDED_STATUSES } from "@/lib/lab-deletion";
import { TERMS_VERSION } from "@/lib/legal";
import { isInterval, isPlanId, planLookupKey } from "@/lib/plans";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/billing/restart  (lab owner)
// Starts a new subscription for a lab whose last one ended. Stripe's Customer
// Portal can't do this. There's no second free trial. The webhook takes the lab
// out of read-only and stops the deletion clock once Stripe confirms.
// Body: { plan, interval, acceptedTerms: true }
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher" || user.labRole !== "owner") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only the lab owner can start a plan." } }, { status: 403 });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ data: null, error: { code: "NOT_CONFIGURED", message: "Billing is not configured yet" } }, { status: 503 });
    }
    const body = await request.json().catch(() => ({}));
    if (!isPlanId(body.plan) || !isInterval(body.interval)) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Choose a plan." } }, { status: 400 });
    }
    if (body.acceptedTerms !== true) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Please agree to the Terms of Service and Privacy Policy to continue." } }, { status: 400 });
    }

    const lab = await db("labs").where({ id: user.labId }).select("name", "stripe_customer_id", "subscription_status").first();
    if (!lab?.stripeCustomerId || !ENDED_STATUSES.includes(lab.subscriptionStatus)) {
      return Response.json({ data: null, error: { code: "CONFLICT", message: "This lab doesn't have an ended subscription to restart." } }, { status: 409 });
    }
    const owner = await db("lab_users").where({ lab_id: user.labId, user_id: user.id }).select("email").first();

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
    const price = (await stripe.prices.list({ lookup_keys: [planLookupKey(body.plan, body.interval)], active: true, limit: 1 })).data[0];
    if (!price) {
      return Response.json({ data: null, error: { code: "NOT_CONFIGURED", message: "That plan isn't available yet. Please contact us." } }, { status: 503 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: lab.stripeCustomerId,
      line_items: [{ price: price.id, quantity: 1 }],
      allow_promotion_codes: true,
      // The webhook's duplicate check recognizes this email, so no new lab is created.
      metadata: {
        email: owner?.email ?? "",
        labName: lab.name,
        plan: body.plan,
        interval: body.interval,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: new Date().toISOString(),
      },
      success_url: `${appUrl}/settings?section=billing`,
      cancel_url: `${appUrl}/settings?section=billing`,
    });
    return Response.json({ data: { url: session.url }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/billing/restart]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Couldn't start checkout" } }, { status: 500 });
  }
}
