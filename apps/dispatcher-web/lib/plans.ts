// Plans the app enforces (pricing agreed 2026-11-01). The public page is
// apps/landing/app/pricing/plans.ts and Stripe holds the real prices, found by
// lookup key; scripts/stripe-setup.mjs creates them. Keep all three in step.

export type PlanId = "starter" | "growth" | "pro";
export type BillingInterval = "month" | "year";

export const TRIAL_DAYS = 30;

export const PLANS: Record<PlanId, { name: string; drivers: number; extraDriverKey: "extra_driver" | "extra_driver_pro" }> = {
  starter: { name: "Starter", drivers: 2, extraDriverKey: "extra_driver" },
  growth: { name: "Growth", drivers: 5, extraDriverKey: "extra_driver" },
  pro: { name: "Pro", drivers: 12, extraDriverKey: "extra_driver_pro" },
};

export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && v in PLANS;
export const isInterval = (v: unknown): v is BillingInterval => v === "month" || v === "year";

/** Stripe lookup key for a plan's base price, e.g. "growth_month". */
export const planLookupKey = (plan: PlanId, interval: BillingInterval) => `${plan}_${interval}`;
/** Stripe lookup key for that plan's extra-driver price, e.g. "extra_driver_pro_year". */
export const extraDriverLookupKey = (plan: PlanId, interval: BillingInterval) => `${PLANS[plan].extraDriverKey}_${interval}`;

/** Reverse of planLookupKey, for subscription webhooks. */
export function parsePlanLookupKey(key: string | null | undefined): { plan: PlanId; interval: BillingInterval } | null {
  const m = /^(starter|growth|pro)_(month|year)$/.exec(key ?? "");
  return m ? { plan: m[1] as PlanId, interval: m[2] as BillingInterval } : null;
}
export const isExtraDriverLookupKey = (key: string | null | undefined) => /^extra_driver(_pro)?_(month|year)$/.test(key ?? "");
