"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ApiResponse } from "@gepeto/types";
import { useAuth } from "@/context/auth";

// Global search: one box for the whole dispatcher app (⌘K or / anywhere).
// Picking a result navigates to its page and leaves a "target" here; the
// page scrolls to the row marked id="search-<kind>-<id>" and flashes it.
// Pages with filters (Jobs, Returning Cases, Drivers) also read the target to
// switch to a filter that shows it, and Jobs expands the job.

export type SearchKind = "job" | "return" | "office" | "driver";

export interface SearchTarget {
  kind: SearchKind;
  id: string;
  /** Returns only: lets Returning Cases pick the right filter. */
  status?: string;
  nonce: number;
}

interface JobHit { id: string; caseId: string; status: string; priority: string; updatedAt: string; officeName: string | null; driverName: string | null }
interface ReturnHit { id: string; number: number; status: string; caseCount: number; caseNumbers: string[]; caseId: string | null; officeName: string | null; driverName: string | null }
interface OfficeHit { id: string; name: string; address: string; contactName: string | null; activeJobs: number }
interface DriverHit { id: string; name: string; status: string; phone: string | null }
interface Results { jobs: JobHit[]; returns: ReturnHit[]; offices: OfficeHit[]; drivers: DriverHit[] }

const PAGE: Record<SearchKind, string> = { job: "/jobs", return: "/returns", office: "/offices", driver: "/drivers" };

interface SearchContextType {
  open: () => void;
  target: SearchTarget | null;
  clearTarget: () => void;
}

const SearchContext = createContext<SearchContextType>({ open: () => {}, target: null, clearTarget: () => {} });
export const useSearch = () => useContext(SearchContext);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [target, setTarget] = useState<SearchTarget | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const clearTarget = useCallback(() => setTarget(null), []);

  // ⌘K / Ctrl+K anywhere; "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((v) => !v);
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const choose = (t: Omit<SearchTarget, "nonce">) => {
    setIsOpen(false);
    setTarget({ ...t, nonce: Date.now() });
    if (pathname !== PAGE[t.kind]) router.push(PAGE[t.kind]);
  };

  // Once the target's page has rendered the row, scroll to it and flash it.
  // Rows can take a moment (data loading), so look for a few seconds.
  useEffect(() => {
    if (!target || pathname !== PAGE[target.kind]) return;
    const domId = `search-${target.kind}-${target.id}`;
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(domId);
      if (!el && ++tries < 40) return;
      clearInterval(timer);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.animate(
        [{ boxShadow: "0 0 0 3px rgba(24,95,165,0.55)", background: "rgba(24,95,165,0.08)" }, { boxShadow: "0 0 0 3px rgba(24,95,165,0)", background: "transparent" }],
        { duration: 2200, easing: "ease-out" }
      );
    }, 100);
    return () => clearInterval(timer);
  }, [target, pathname]);

  return (
    <SearchContext.Provider value={{ open, target, clearTarget }}>
      {children}
      {isOpen && <SearchPalette onClose={() => setIsOpen(false)} onChoose={choose} />}
    </SearchContext.Provider>
  );
}

/** The trigger look shared by the dashboard box and the sidebar button. */
export function SearchTrigger({ width = 220, compact = false }: { width?: number | string; compact?: boolean }) {
  const { open } = useSearch();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Search jobs, returns, offices and drivers"
      style={{
        display: "flex", alignItems: "center", gap: 7, width, boxSizing: "border-box",
        background: "#F8F9FB", border: "1px solid rgba(0,0,0,0.10)", borderRadius: 7,
        padding: "6px 9px", cursor: "pointer", textAlign: "left",
      }}
    >
      <SearchIcon />
      <span style={{ flex: 1, fontSize: 12.5, color: "#9a9a9a" }}>{compact ? "Search…" : "Search jobs, offices…"}</span>
      <kbd style={{ fontSize: 10.5, color: "#5F5E5A", background: "#fff", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 4, padding: "0 5px", fontFamily: "inherit" }}>
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

export function SearchIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" style={{ opacity: 0.5, flexShrink: 0 }} aria-hidden="true">
      <circle cx="5.5" cy="5.5" r="4" stroke="#1a1a1a" strokeWidth="1.3" />
      <path d="M8.5 8.5L11 11" stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

// ── Palette ───────────────────────────────────────────────────────────────────

const JOB_STATUS: Record<string, string> = {
  pending: "Pending", assigned: "Assigned", picked_up: "Picked up", in_transit: "In transit",
  arrived: "Arrived", delivered: "Delivered", rejected: "Rejected",
};
const RETURN_STATUS: Record<string, string> = {
  requested: "Pickup requested", with_driver: "With driver", at_lab: "At lab", checked_in: "Checked in",
};
const DRIVER_STATUS: Record<string, string> = { available: "Available", on_delivery: "On delivery", off_duty: "Off duty" };

type Item = { key: string; target: Omit<SearchTarget, "nonce">; title: string; subtitle: string; badge?: string };

function SearchPalette({ onClose, onChoose }: { onClose: () => void; onChoose: (t: Omit<SearchTarget, "nonce">) => void }) {
  const { apiFetch } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [phone, setPhone] = useState(false);
  const seq = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setPhone(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("resize", check);
      document.body.style.overflow = overflow;
    };
  }, []);

  // Debounced search; only the latest request's answer is shown.
  useEffect(() => {
    const term = q.trim();
    const mine = ++seq.current;
    if (term.length < 2) return;
    const t = setTimeout(() => {
      setLoading(true);
      apiFetch<ApiResponse<Results>>(`/api/search?q=${encodeURIComponent(term)}`)
        .then((res) => {
          if (mine !== seq.current) return;
          setResults(res.data ?? null);
          setActive(0);
        })
        .catch(() => {})
        .finally(() => { if (mine === seq.current) setLoading(false); });
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const term = q.trim();
  const shown = term.length >= 2 ? results : null;
  const groups: { label: string; items: Item[] }[] = shown
    ? [
        {
          label: "Jobs",
          items: shown.jobs.map((j) => ({
            key: `job-${j.id}`,
            target: { kind: "job" as const, id: j.id },
            title: j.caseId,
            subtitle: [j.officeName, j.driverName ?? "No driver", new Date(j.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })].filter(Boolean).join(" · "),
            badge: (j.priority === "stat" ? "STAT · " : "") + (JOB_STATUS[j.status] ?? j.status),
          })),
        },
        {
          label: "Returns & pickups",
          items: shown.returns.map((r) => ({
            key: `return-${r.id}`,
            target: { kind: "return" as const, id: r.id, status: r.status },
            title: `RET-${r.number}${r.caseId ? ` · ${r.caseId}` : ""}`,
            subtitle: [r.officeName, r.driverName, `${r.caseCount} case${r.caseCount === 1 ? "" : "s"}`, r.caseNumbers.length ? r.caseNumbers.join(", ") : null].filter(Boolean).join(" · "),
            badge: RETURN_STATUS[r.status] ?? r.status,
          })),
        },
        {
          label: "Offices",
          items: shown.offices.map((o) => ({
            key: `office-${o.id}`,
            target: { kind: "office" as const, id: o.id },
            title: o.name,
            subtitle: [o.contactName, o.address].filter(Boolean).join(" · "),
            badge: o.activeJobs ? `${o.activeJobs} active` : undefined,
          })),
        },
        {
          label: "Drivers",
          items: shown.drivers.map((d) => ({
            key: `driver-${d.id}`,
            target: { kind: "driver" as const, id: d.id },
            title: d.name,
            subtitle: d.phone ?? "",
            badge: DRIVER_STATUS[d.status] ?? d.status,
          })),
        },
      ].filter((g) => g.items.length > 0)
    : [];
  const flat = groups.flatMap((g) => g.items);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
    if (!flat.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % flat.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + flat.length) % flat.length); }
    else if (e.key === "Enter") { e.preventDefault(); onChoose(flat[Math.min(active, flat.length - 1)].target); }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let index = -1;
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        // Above Leaflet's map controls (z-index up to 1000) on the dashboard.
        position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(2px)",
        display: "flex", justifyContent: "center", alignItems: phone ? "stretch" : "flex-start", paddingTop: phone ? 0 : "12vh",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={onKeyDown}
        style={{
          background: "#fff", width: "100%", maxWidth: phone ? "none" : 600, margin: phone ? 0 : "0 16px",
          borderRadius: phone ? 0 : 14, boxShadow: "0 24px 64px rgba(0,0,0,0.22)", overflow: "hidden",
          display: "flex", flexDirection: "column", maxHeight: phone ? "100%" : "70vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <SearchIcon size={16} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Case number, RET number, office, driver, item…"
            aria-label="Search"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls="search-results"
            aria-activedescendant={flat.length ? `search-opt-${Math.min(active, flat.length - 1)}` : undefined}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 15, color: "#1a1a1a", background: "transparent" }}
          />
          {loading && <span style={{ fontSize: 11.5, color: "#9a9a9a" }}>Searching…</span>}
          <button onClick={onClose} style={{ fontSize: 11.5, color: "#5F5E5A", background: "#F1F1EF", border: "none", borderRadius: 5, padding: "3px 7px", cursor: "pointer" }}>
            Esc
          </button>
        </div>

        <div ref={listRef} id="search-results" role="listbox" style={{ overflowY: "auto", padding: "6px 0 10px" }}>
          {term.length < 2 ? (
            <Hint>Search by case number (LAB-2042, 2042), RET number, office, driver, item or address. Active jobs come first.</Hint>
          ) : !shown && loading ? (
            <Hint>Searching…</Hint>
          ) : flat.length === 0 ? (
            <Hint>No matches for &ldquo;{term}&rdquo;.</Hint>
          ) : (
            groups.map((g) => (
              <div key={g.label}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 16px 4px" }}>
                  {g.label}
                </div>
                {g.items.map((it) => {
                  index += 1;
                  const i = index;
                  const isActive = i === Math.min(active, flat.length - 1);
                  return (
                    <div
                      key={it.key}
                      id={`search-opt-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isActive}
                      onMouseMove={() => setActive(i)}
                      onClick={() => onChoose(it.target)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", cursor: "pointer",
                        background: isActive ? "#EBF2FA" : "transparent",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a", fontFamily: it.target.kind === "job" || it.target.kind === "return" ? "monospace" : "inherit" }}>
                          {it.title}
                        </div>
                        {it.subtitle && (
                          <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.subtitle}</div>
                        )}
                      </div>
                      {it.badge && (
                        <span style={{ flexShrink: 0, fontSize: 11, color: "#3a3a3a", background: "#F1F1EF", borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>
                          {it.badge}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "18px 16px", fontSize: 12.5, color: "#9a9a9a", lineHeight: 1.5 }}>{children}</div>;
}
