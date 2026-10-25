import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Gepeto",
};

export default function PrivacyPage() {
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

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-10">Last updated: coming soon</p>

        <div className="p-6 rounded-2xl border border-blue/20 bg-blue-light text-gray-700 text-sm leading-relaxed">
          <p className="font-semibold text-gray-900 mb-2">This policy is being finalized.</p>
          <p>
            Gepeto&apos;s Privacy Policy is currently being drafted and will be published in full
            prior to general availability. Our policy will cover what data we collect, how it is
            used, who it is shared with, and your rights as a user.
          </p>
          <p className="mt-3">
            In the meantime, if you have any questions about your data or our privacy practices,
            please reach out at{" "}
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
