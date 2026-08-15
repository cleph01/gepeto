import Stripe from "stripe";
import type { NextRequest } from "next/server";

// POST /api/stripe/checkout
// Creates a Stripe Checkout Session for a new lab subscription.
// Body: { email: string; labName: string }
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

    const { email, labName } = await request.json();

    if (!email?.trim() || !labName?.trim()) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "email and labName are required" } },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email.trim(),
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { email: email.trim(), labName: labName.trim() },
      },
      // Metadata on the session so the webhook can access it directly
      metadata: { email: email.trim(), labName: labName.trim() },
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
