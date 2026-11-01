"use client";

import { useState } from "react";
import { PLANS, TRIAL_DAYS, type Plan } from "./plans";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

// Plan cards with the monthly / annual switch. Buttons pre-select the plan and
// billing period on the signup page.
export function PlanCards() {
  const [annual, setAnnual] = useState(false);
  return (
    <div>
      <div className="flex justify-center mb-10">
        <div role="radiogroup" aria-label="Billing period" className="inline-flex items-center gap-1 rounded-full bg-gray-100 p-1">
          {[false, true].map((isAnnual) => (
            <button
              key={String(isAnnual)}
              role="radio"
              aria-checked={annual === isAnnual}
              onClick={() => setAnnual(isAnnual)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                annual === isAnnual ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {isAnnual ? (
                <>
                  Annual <span className="ml-1 text-xs font-semibold text-[#3B6D11]">2 months free</span>
                </>
              ) : (
                "Monthly"
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 items-stretch">
        {PLANS.map((p) => (
          <PlanCard key={p.id} plan={p} annual={annual} />
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan, annual }: { plan: Plan; annual: boolean }) {
  const href = `${APP_URL}/signup?plan=${plan.id}&interval=${annual ? "year" : "month"}`;
  return (
    <div
      className={`relative flex flex-col rounded-2xl bg-white p-7 ${
        plan.highlight ? "ring-2 ring-blue shadow-xl md:-translate-y-2" : "ring-1 ring-gray-200 shadow-sm"
      }`}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue px-3 py-1 text-xs font-semibold text-white">
          Most popular
        </span>
      )}
      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
      <p className="mt-1 text-sm text-gray-500">{plan.blurb}</p>

      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-gray-900">
          {usd(annual ? Math.round(plan.annual / 12) : plan.monthly)}
        </span>
        <span className="text-sm text-gray-500">/month</span>
      </div>
      <p className="mt-1 h-5 text-xs text-gray-500">
        {annual ? `${usd(plan.annual)} billed yearly` : "Billed monthly"}
      </p>

      <ul className="mt-6 space-y-3 text-sm text-gray-700 flex-1">
        <li className="flex gap-2">
          <Check />
          <span>
            <strong className="font-semibold text-gray-900">{plan.drivers} drivers</strong> included, then{" "}
            {usd(plan.extraDriver)}/month each
          </span>
        </li>
        <li className="flex gap-2">
          <Check />
          <span>{plan.dispatchers}</span>
        </li>
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={href}
        className={`mt-8 block rounded-xl px-5 py-3 text-center text-sm font-semibold transition-colors ${
          plan.highlight ? "bg-blue text-white hover:bg-blue-dark" : "bg-gray-900 text-white hover:bg-gray-700"
        }`}
      >
        Start {TRIAL_DAYS}-day free trial
      </a>
      <p className="mt-2 text-center text-xs text-gray-400">Nothing charged for {TRIAL_DAYS} days</p>
    </div>
  );
}

export function Check() {
  return (
    <svg className="mt-0.5 h-4 w-4 shrink-0 text-[#3B6D11]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
