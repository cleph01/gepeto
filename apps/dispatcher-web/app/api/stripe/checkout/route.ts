import Stripe from "stripe";
import type { NextRequest } from "next/server";
import { TERMS_VERSION } from "@/lib/legal";
import { TRIAL_DAYS, isInterval, isPlanId, planLookupKey } from "@/lib/plans";

// POST /api/stripe/checkout
// Creates a Stripe Checkout Session for a new lab subscription.
// Body: { email: string; labName: string; acceptedTerms: true; plan?: "starter"|"growth"|"pro"; interval?: "month"|"year" }
// A card is required up front but not charged until the trial ends. If the
// card is removed during the trial (Customer Portal), the subscription cancels
// at the end of the trial instead of billing.
// Returns: { url: string } — the Stripe hosted checkout URL
export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json(
        { data: null, error: { code: "NOT_CONFIGURED", message: "Billing is not configured yet" } },
        { status: 503 }
      );
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    });

    const body = await request.json();
    const { email, labName } = body;
    const plan = isPlanId(body.plan) ? body.plan : "growth";
    const interval = isInterval(body.interval) ? body.interval : "month";

    if (!email?.trim() || !labName?.trim()) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "email and labName are required" } },
        { status: 400 }
      );
    }

    if (body.acceptedTerms !== true) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "Please agree to the Terms of Service and Privacy Policy to continue." } },
        { status: 400 }
      );
    }
    // Set here, not by the browser. Saved on the lab once Stripe confirms signup.
    const acceptance = { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date().toISOString() };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const lookupKey = planLookupKey(plan, interval);
    const price = (await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })).data[0];
    if (!price) {
      console.error("[checkout] no Stripe price for", lookupKey, "- run scripts/stripe-setup.mjs");
      return Response.json(
        { data: null, error: { code: "NOT_CONFIGURED", message: "That plan isn't available yet. Please contact us." } },
        { status: 503 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email.trim(),
      line_items: [{ price: price.id, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
        metadata: { email: email.trim(), labName: labName.trim(), plan, interval },
      },
      // Metadata on the session so the webhook can access it directly
      metadata: { email: email.trim(), labName: labName.trim(), plan, interval, ...acceptance },
      success_url: `${appUrl}/signup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/signup`,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("[POST /api/stripe/checkout]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to create checkout session" } },
      { status: 500 }
    );
  }
}
