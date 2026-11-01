// Pricing shown on /pricing. Agreed 2026-11-01. The dispatcher app has the
// matching enforcement config (apps/dispatcher-web/lib/plans.ts) and Stripe
// holds the real prices (lookup keys like "growth_monthly"); keep all three in
// step when a price changes.

export type PlanId = "starter" | "growth" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  blurb: string;
  monthly: number;
  annual: number; // per year (10x monthly: two months free)
  drivers: number;
  extraDriver: number; // per driver per month beyond `drivers`
  dispatchers: string;
  highlight?: boolean;
  features: string[];
}

export const TRIAL_DAYS = 30;
export const FOUNDING = { percentOff: 50, months: 12 };

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    blurb: "For a small lab with a driver or two.",
    monthly: 99,
    annual: 990,
    drivers: 2,
    extraDriver: 25,
    dispatchers: "2 dispatcher logins",
    features: ["The complete Gepeto platform", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    blurb: "For labs running a real delivery route.",
    monthly: 199,
    annual: 1990,
    drivers: 5,
    extraDriver: 25,
    dispatchers: "Unlimited dispatcher logins",
    highlight: true,
    features: ["Everything in Starter", "Reports and data export", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For busy labs with a full fleet.",
    monthly: 349,
    annual: 3490,
    drivers: 12,
    extraDriver: 20,
    dispatchers: "Unlimited dispatcher logins",
    features: ["Everything in Growth", "Your lab's logo on the office tracking page", "Priority support"],
  },
];

/** In every plan: the core of Gepeto is never held back. */
export const INCLUDED = [
  "Unlimited jobs, offices and tracking links",
  "Live driver tracking for dispatch and offices",
  "Driver app with job alerts and proof of delivery",
  "Messaging between the lab, drivers and offices",
  "Returning cases and office pickup requests",
  "Search across every job, return, office and driver",
  "Free for your dental offices, always",
];

export const COMPARE: { label: string; values: [string, string, string] }[] = [
  { label: "Drivers included", values: ["2", "5", "12"] },
  { label: "Extra drivers", values: ["$25/mo each", "$25/mo each", "$20/mo each"] },
  { label: "Dispatcher logins", values: ["2", "Unlimited", "Unlimited"] },
  { label: "Jobs, offices, tracking links", values: ["Unlimited", "Unlimited", "Unlimited"] },
  { label: "Reports and data export", values: ["—", "✓", "✓"] },
  { label: "Lab branding on the office page", values: ["—", "—", "✓"] },
  { label: "Support", values: ["Email", "Email", "Priority"] },
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: "What counts as a driver?",
    a: "Anyone who can sign in to the Gepeto driver app for your lab. Deactivated drivers don't count, so seasonal or part-time drivers only count while they're active.",
  },
  {
    q: "Do our dental offices pay anything?",
    a: "No. Offices use their tracking link for free, with no account or password. Give every office you serve a link.",
  },
  {
    q: "How does the free trial work?",
    a: `You get ${TRIAL_DAYS} days with everything in your plan and no credit card required. Add a card any time before the trial ends to keep going; if you don't, the trial simply ends.`,
  },
  {
    q: "Can I change plans later?",
    a: "Yes, any time, from Settings. Upgrades take effect right away, and changes are prorated, so you only pay for what you use.",
  },
  {
    q: "Is annual billing worth it?",
    a: "Annual plans cost ten months instead of twelve, so you get two months free.",
  },
  {
    q: "Do you store patient information?",
    a: "No. Gepeto is built around case numbers and products, not patients, so patient names and health details stay in your lab and practice systems.",
  },
  {
    q: "We have several locations. How does that work?",
    a: "Talk to us. Multi-location labs get one account across locations, with pricing built around your fleet.",
  },
];
