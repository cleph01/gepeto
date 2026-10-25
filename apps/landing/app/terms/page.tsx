import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Gepeto",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-10"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Gepeto
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: coming soon</p>

        <div className="p-6 rounded-2xl border border-blue/20 bg-blue-light text-gray-700 text-sm leading-relaxed">
          <p className="font-semibold text-gray-900 mb-2">These terms are being finalized.</p>
          <p>
            Gepeto&apos;s Terms of Service are currently being drafted and will be published in full
            prior to general availability. Our terms will govern your use of the Gepeto platform,
            including account responsibilities, acceptable use, billing, and liability.
          </p>
          <p className="mt-3">
            If you have any questions in the meantime, please contact us at{" "}
            <a
              href="mailto:hello@gepeto.com"
              className="text-blue font-medium hover:underline"
            >
              hello@gepeto.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
