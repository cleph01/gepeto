import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { driverAllowance } from "@/lib/billing";
import { deletionDate } from "@/lib/lab-deletion";
import { PLANS, isPlanId } from "@/lib/plans";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/billing  (dispatcher)
// The lab's plan for Settings → Plan & billing: plan, status, dates and how
// many of its driver spots are in use.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Dispatchers only" } }, { status: 403 });
    }
    const lab = await db("labs")
      .where({ id: user.labId })
      .select("plan", "billing_interval", "driver_limit", "extra_drivers", "subscription_status", "trial_ends_at", "current_period_end", "subscription_ended_at", "stripe_customer_id")
      .first();
    const allowance = await driverAllowance(user.labId);
    return Response.json({
      data: {
        plan: lab?.plan ?? null,
        planName: isPlanId(lab?.plan) ? PLANS[lab.plan as keyof typeof PLANS].name : null,
        interval: lab?.billingInterval ?? null,
        includedDrivers: lab?.driverLimit ?? null,
        extraDrivers: lab?.extraDrivers ?? 0,
        driverLimit: allowance.limit,
        activeDrivers: allowance.active,
        status: lab?.subscriptionStatus ?? null,
        trialEndsAt: lab?.trialEndsAt ?? null,
        currentPeriodEnd: lab?.currentPeriodEnd ?? null,
        dataDeletedOn: lab?.subscriptionEndedAt ? deletionDate(lab.subscriptionEndedAt).toISOString() : null,
        isOwner: user.labRole === "owner",
        hasSubscription: !!lab?.stripeCustomerId,
        canManage: !!lab?.stripeCustomerId && user.labRole === "owner",
        billingConfigured: !!process.env.STRIPE_SECRET_KEY,
      },
      error: null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/billing]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load billing" } }, { status: 500 });
  }
}
