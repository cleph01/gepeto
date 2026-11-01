// Driver allowance per plan: how many drivers a lab may have active
// (anything but Off Duty) at once. Labs with no plan have no limit.
import { PLANS, isPlanId } from "@/lib/plans";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

export interface Allowance {
  plan: string | null;
  limit: number | null; // null = unlimited
  active: number;
}

export async function driverAllowance(labId: string): Promise<Allowance> {
  const lab = await db("labs").where({ id: labId }).select("plan", "driver_limit", "extra_drivers").first();
  const row = await db("drivers").where({ lab_id: labId }).whereNot("status", "off_duty").count("* as n").first();
  const active = Number(row?.n ?? 0);
  if (!lab || lab.driverLimit === null || lab.driverLimit === undefined) return { plan: lab?.plan ?? null, limit: null, active };
  return { plan: lab.plan, limit: lab.driverLimit + (lab.extraDrivers ?? 0), active };
}

/** A 402 response when one more active driver would exceed the plan, else null. */
export async function checkDriverRoom(labId: string): Promise<Response | null> {
  const a = await driverAllowance(labId);
  if (a.limit === null || a.active < a.limit) return null;
  const planName = isPlanId(a.plan) ? PLANS[a.plan].name : "current";
  return Response.json(
    {
      data: null,
      error: {
        code: "PLAN_LIMIT",
        message: `Your ${planName} plan includes ${a.limit} active driver${a.limit === 1 ? "" : "s"}. Add a driver or upgrade in Settings → Plan & billing, or set another driver Off Duty.`,
      },
    },
    { status: 402 }
  );
}
