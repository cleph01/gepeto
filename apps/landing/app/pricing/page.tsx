import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Check, PlanCards } from "./billing-toggle";
import { COMPARE, FAQ, FOUNDING, INCLUDED, PLANS, TRIAL_DAYS } from "./plans";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Pricing — Gepeto",
  description: `Simple per-lab pricing for Gepeto, from $${PLANS[0].monthly}/month. Free for your dental offices. ${TRIAL_DAYS}-day free trial.`,
};

export default function PricingPage() {
  return (
    <div className="font-sans min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.08)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center ring-1 ring-gray-100">
              <Image src="/gepeto-icon.png" alt="" width={32} height={32} className="w-full h-full" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">Gepeto</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/features" className="hidden sm:inline-flex px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
              Why Gepeto
            </Link>
            <a href={`${APP_URL}/login`} className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors">
              Log in
            </a>
            <a href={`${APP_URL}/signup`} className="px-4 py-2 bg-blue hover:bg-blue-dark text-white text-sm font-semibold rounded-lg transition-colors">
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-hero text-white">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-16 sm:py-20 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7DB4EA] mb-4">Pricing</p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
            One price for your lab. Free for your offices.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/65 max-w-2xl mx-auto leading-relaxed">
            Pick a plan by how many drivers you run. Every plan includes the whole of Gepeto, and every
            plan starts with a {TRIAL_DAYS}-day free trial. Nothing is charged until it ends.
          </p>
        </div>
      </section>

      {/* Founding labs */}
      <div className="bg-[#EBF2FA] border-b border-[#C0D9F0]">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-3 text-center text-sm text-[#124B87]">
          <strong className="font-semibold">Founding labs:</strong> {FOUNDING.percentOff}% off any plan for your first{" "}
          {FOUNDING.months} months. Ask us for a founding-lab code at{" "}
          <a href="mailto:hello@gepeto.delivery" className="underline underline-offset-2 font-medium">hello@gepeto.delivery</a>.
        </div>
      </div>

      {/* Plans */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
        <PlanCards />
      </section>

      {/* Every plan includes */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 text-center">Every plan includes</h2>
          <p className="mt-2 text-center text-gray-500 text-sm">The core of Gepeto is never held back for a bigger plan.</p>
          <ul className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2 text-sm text-gray-700 max-w-3xl mx-auto">
            {INCLUDED.map((f) => (
              <li key={f} className="flex gap-2">
                <Check />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Compare */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 text-center mb-8">Compare plans</h2>
        <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-500"><span className="sr-only">Feature</span></th>
                {PLANS.map((p) => (
                  <th key={p.id} className="px-4 py-3 font-semibold text-gray-900 text-center">
                    {p.name}
                    <span className="block text-xs font-normal text-gray-500">${p.monthly}/mo</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.label} className="border-t border-gray-100">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-gray-700">{row.label}</th>
                  {row.values.map((v, i) => (
                    <td key={i} className={`px-4 py-3 text-center ${v === "—" ? "text-gray-300" : "text-gray-800"}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">
          Running several locations?{" "}
          <a href="mailto:hello@gepeto.delivery" className="font-medium text-blue underline underline-offset-2">Talk to us</a> about one
          account for all of them.
        </p>
      </section>

      {/* FAQ */}
      <section className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 text-center mb-8">Pricing questions</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-xl bg-white ring-1 ring-gray-200 px-5 py-4">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-gray-900">
                  {f.q}
                  <span className="text-gray-400 transition-transform group-open:rotate-45 text-xl leading-none" aria-hidden="true">+</span>
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-hero text-white">
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Try Gepeto free for {TRIAL_DAYS} days</h2>
          <p className="mt-3 text-white/60">Cancel any time during the trial and you pay nothing. Set up your offices and drivers in an afternoon.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href={`${APP_URL}/signup?plan=growth&interval=month`} className="px-7 py-3.5 bg-white text-gray-900 hover:bg-gray-100 text-sm font-semibold rounded-xl transition-colors">
              Start free trial →
            </a>
            <a href="mailto:hello@gepeto.delivery" className="px-7 py-3.5 text-white/80 hover:text-white text-sm font-medium rounded-xl border border-white/20 hover:bg-white/10 transition-colors">
              Talk to us
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-600">Gepeto</Link> ·{" "}
        <Link href="/features" className="hover:text-gray-600">Why Gepeto</Link> ·{" "}
        <Link href="/privacy" className="hover:text-gray-600">Privacy</Link> ·{" "}
        <Link href="/terms" className="hover:text-gray-600">Terms</Link>
      </footer>
    </div>
  );
}
