import Stripe from "stripe";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/billing/portal  (lab owner)
// Opens Stripe's hosted Customer Portal, where the lab changes plan, adds a
// card, adds drivers or cancels. Changes come back through the webhook.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher" || user.labRole !== "owner") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only the lab owner can manage billing" } }, { status: 403 });
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return Response.json({ data: null, error: { code: "NOT_CONFIGURED", message: "Billing is not configured yet" } }, { status: 503 });
    }
    const lab = await db("labs").where({ id: user.labId }).select("stripe_customer_id").first();
    if (!lab?.stripeCustomerId) {
      return Response.json({ data: null, error: { code: "NO_SUBSCRIPTION", message: "This lab doesn't have a subscription to manage." } }, { status: 400 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const session = await stripe.billingPortal.sessions.create({
      customer: lab.stripeCustomerId,
      return_url: `${appUrl}/settings?section=billing`,
    });
    return Response.json({ data: { url: session.url }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/billing/portal]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Couldn't open billing" } }, { status: 500 });
  }
}
