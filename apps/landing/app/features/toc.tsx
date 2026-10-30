"use client";

import { useEffect, useState } from "react";

type TocEntry = { id: string; title: string; children: { id: string; title: string }[] };

// Sticky table of contents: highlights the section in view. On phones it's a
// collapsible "On this page" menu above the content.
export function FeatureToc({ entries }: { entries: TocEntry[] }) {
  // Tracks the subsection being read; its section is highlighted with it.
  const [active, setActive] = useState<string>(entries[0]?.children[0]?.id ?? "");

  useEffect(() => {
    const ids = entries.flatMap((e) => e.children.map((c) => c.id));
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const observer = new IntersectionObserver(
      (records) => {
        // Of the subsections crossing the reading line, the one that started last.
        const visible = records.filter((r) => r.isIntersecting).sort((a, b) => b.boundingClientRect.top - a.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // A heading counts as "current" once it's in the top third of the screen.
      { rootMargin: "-80px 0px -66% 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [entries]);

  const list = (onPick?: () => void) => (
    <ol className="space-y-4">
      {entries.map((e) => {
        const inSection = active === e.id || e.children.some((c) => c.id === active);
        return (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              onClick={onPick}
              className={`block text-sm font-semibold transition-colors ${inSection ? "text-blue" : "text-gray-900 hover:text-blue"}`}
            >
              {e.title}
            </a>
            <ol className="mt-2 space-y-1.5 border-l border-gray-200">
              {e.children.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    onClick={onPick}
                    className={`-ml-px block border-l pl-3 text-[13px] leading-snug transition-colors ${
                      active === c.id
                        ? "border-blue text-blue font-medium"
                        : "border-transparent text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    {c.title}
                  </a>
                </li>
              ))}
            </ol>
          </li>
        );
      })}
    </ol>
  );

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <nav aria-label="Table of contents" className="hidden lg:block sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">On this page</p>
        {list()}
      </nav>

      {/* Phones and tablets: collapsible menu */}
      <MobileToc>{(close) => list(close)}</MobileToc>
    </>
  );
}

function MobileToc({ children }: { children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden mb-10 rounded-2xl border border-gray-200 bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900"
      >
        On this page
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5">{children(() => setOpen(false))}</div>}
    </div>
  );
}

// The browser's own Save as PDF, with the print layout from globals.css.
export function DownloadPdfButton({ className, label = "Download PDF" }: { className?: string; label?: string }) {
  return (
    <button onClick={() => window.print()} className={className}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
