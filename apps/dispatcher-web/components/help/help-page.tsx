"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useHelp } from "@/context/help";
import type { HelpManual } from "@/lib/help/types";

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="help-button">
      {label}
    </button>
  );
}

// Header, loading and error states shared by every help page.
export function HelpPage({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: (manual: HelpManual) => ReactNode;
}) {
  const { manual, failed, retry } = useHelp();

  return (
    <div className="help-page">
      <header className="help-header no-print">
        <div style={{ minWidth: 0 }}>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action}
      </header>
      <div className="help-column">
        {manual ? (
          children(manual)
        ) : failed ? (
          <div role="alert">
            <p>Help couldn&apos;t load. Check your connection and try again.</p>
            <button type="button" onClick={retry} className="help-button">Try again</button>
          </div>
        ) : (
          <div aria-label="Loading help" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="skeleton" style={{ height: 22, width: "45%" }} />
            <div className="skeleton" style={{ height: 14 }} />
            <div className="skeleton" style={{ height: 14, width: "80%" }} />
          </div>
        )}
      </div>
    </div>
  );
}

export function BackToHelp() {
  return <Link href="/help" className="help-back no-print">← All help topics</Link>;
}
