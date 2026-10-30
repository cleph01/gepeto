import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SECTIONS } from "./content";
import { DownloadPdfButton, FeatureToc } from "./toc";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "Why Gepeto — Dental Lab Delivery, Simplified",
  description:
    "Every Gepeto feature for dental lab dispatchers, delivery drivers and dental offices: live job tracking, instant alerts, grouped stops, proof of delivery and more.",
};

const TOC = SECTIONS.map((s) => ({
  id: s.id,
  title: s.title,
  children: s.groups.map((g) => ({ id: g.id, title: g.title })),
}));

const featureCount = SECTIONS.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.features.length, 0), 0);

export default function FeaturesPage() {
  return (
    <div className="font-sans min-h-screen bg-white">
      {/* Header */}
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.08)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-white p-1 flex items-center justify-center ring-1 ring-gray-100">
              <Image src="/gepeto-icon.png" alt="" width={32} height={32} className="w-full h-full" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900">Gepeto</span>
          </Link>
          <div className="flex items-center gap-2">
            <DownloadPdfButton className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors" />
            <a
              href={`${APP_URL}/signup`}
              className="px-4 py-2 bg-blue hover:bg-blue-dark text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </header>

      {/* Print-only letterhead */}
      <div className="print-only items-center gap-3 pb-6 mb-8 border-b border-gray-200">
        <Image src="/gepeto-icon.png" alt="" width={36} height={36} />
        <div>
          <p className="text-lg font-bold text-gray-900 leading-tight">Gepeto</p>
          <p className="text-xs text-gray-500">Dental lab delivery, simplified · gepeto.delivery</p>
        </div>
      </div>

      {/* Hero */}
      <section className="feature-hero bg-hero text-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7DB4EA] mb-4">Why Gepeto</p>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight max-w-2xl leading-tight">
            Everything Gepeto does, in plain language.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/65 max-w-2xl leading-relaxed">
            {featureCount} details that make dental lab deliveries calmer, for the people at the front desk, on the road
            and at the dental office.
          </p>
          <div className="no-print mt-8 flex flex-wrap gap-3">
            <DownloadPdfButton
              label="Download the brochure (PDF)"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-colors"
            />
            <a
              href={`${APP_URL}/signup`}
              className="inline-flex items-center px-5 py-3 rounded-xl text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-16 lg:grid lg:grid-cols-[220px_1fr] lg:gap-16 print:block print:p-0">
        <aside className="no-print">
          <FeatureToc entries={TOC} />
        </aside>

        <main className="min-w-0 space-y-20 feature-body">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 feature-section">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue mb-2">{section.eyebrow}</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{section.title}</h2>
              <p className="mt-3 text-base text-gray-600 leading-relaxed max-w-2xl">{section.intro}</p>

              <div className="mt-10 space-y-12">
                {section.groups.map((group) => (
                  <div key={group.id} id={group.id} className="scroll-mt-24">
                    <h3 className="text-lg font-semibold text-gray-900 mb-5">{group.title}</h3>
                    <ul className="grid sm:grid-cols-2 gap-4">
                      {group.features.map((f) => (
                        <li key={f.title} className="feature-card rounded-2xl border border-gray-200 bg-white p-5">
                          <p className="font-semibold text-gray-900 text-[15px]">{f.title}</p>
                          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{f.body}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Closing CTA */}
          <section className="no-print rounded-3xl bg-blue-light border border-blue/15 p-8 sm:p-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Ready to retire the group texts?</h2>
            <p className="mt-2 text-gray-600">Set up your lab, add your drivers and offices, and send your first job today.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={`${APP_URL}/signup`}
                className="inline-flex items-center px-5 py-3 rounded-xl text-sm font-semibold bg-blue hover:bg-blue-dark text-white transition-colors"
              >
                Get Started
              </a>
              <a
                href="mailto:hello@gepeto.com"
                className="inline-flex items-center px-5 py-3 rounded-xl text-sm font-semibold text-blue border border-blue/25 hover:bg-white transition-colors"
              >
                Talk to us
              </a>
            </div>
          </section>

          <p className="print-only text-xs text-gray-500 pt-6 border-t border-gray-200">
            Questions? hello@gepeto.com · Get started at gepeto.delivery
          </p>
        </main>
      </div>

      <footer className="no-print border-t border-gray-100 py-8 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p>© {new Date().getFullYear()} Gepeto. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
            <a href="mailto:hello@gepeto.com" className="hover:text-gray-600 transition-colors">Contact</a>
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
