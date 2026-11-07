import Stripe from "stripe";
import type { NextRequest } from "next/server";
import { sendLabDeletionWarning } from "@/lib/email";
import { runLabDeletion } from "@/lib/lab-deletion";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const LIVE_STATUSES = ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"];

/**
 * GET /api/cron/lab-deletion
 *
 * Nightly (Vercel Cron). Warns, then deletes, labs whose subscription ended 90
 * days ago. See lib/lab-deletion.ts. Unlike the other cron routes, this one
 * refuses to run at all without CRON_SECRET, because it deletes data.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ skipped: "Billing isn't configured, so no subscription can be confirmed as ended." });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2026-03-25.dahlia" });

  try {
    const result = await runLabDeletion(process.env.LAB_DELETION_ENABLED === "true", {
      async subscriptionIsOver(customerId) {
        const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
        return !subs.has_more && !subs.data.some((s) => LIVE_STATUSES.includes(s.status));
      },
      async sendWarning(labId, deleteOn) {
        const lab = await db("labs").where({ id: labId }).select("name").first();
        const owners: { email: string | null }[] = await db("lab_users").where({ lab_id: labId, lab_role: "owner" }).select("email");
        const to = owners.map((o) => o.email).filter((e): e is string => !!e);
        if (to.length === 0) throw new Error("No owner email to warn");
        const res = await sendLabDeletionWarning(to, { labName: lab?.name ?? "Your lab", deleteOn });
        if (res.error) throw new Error(`Warning email failed: ${res.error.message}`);
      },
    });
    console.log("[cron/lab-deletion]", JSON.stringify(result));
    return Response.json(result);
  } catch (err) {
    console.error("[cron/lab-deletion]", err);
    return Response.json({ error: "Lab deletion run failed" }, { status: 500 });
  }
}
