"use client";

import { useEffect, useState } from "react";

// Sortable column headers shared by Jobs, the Dashboard table and Returning
// Cases. A click sorts by the column in its natural order (▲), a second click
// reverses it (▼), a third goes back to the page's default order. The choice
// is remembered per page in this browser.

export type SortState<K extends string> = { key: K; dir: "asc" | "desc" } | null;

/** Sort comparators per column, written for the natural ("asc") order. */
export type Comparators<T, K extends string> = Record<K, (a: T, b: T) => number>;

export function useSort<K extends string>(storageKey: string, keys: readonly K[]) {
  const [sort, setSort] = useState<SortState<K>>(null);

  // Read after mount so the server render and first client render match.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved && keys.includes(saved.key) && (saved.dir === "asc" || saved.dir === "desc")) setSort(saved);
    } catch {
      // Unreadable: keep the default order.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const choose = (next: SortState<K>) => {
    setSort(next);
    if (next) localStorage.setItem(storageKey, JSON.stringify(next));
    else localStorage.removeItem(storageKey);
  };

  const toggle = (key: K) => {
    if (!sort || sort.key !== key) choose({ key, dir: "asc" });
    else if (sort.dir === "asc") choose({ key, dir: "desc" });
    else choose(null);
  };

  return { sort, toggle, choose };
}

/** Rows in the chosen order; ties fall back to `tieBreak`, then the original order. */
export function sortRows<T, K extends string>(
  rows: T[],
  sort: SortState<K>,
  comparators: Comparators<T, K>,
  tieBreak?: (a: T, b: T) => number
): T[] {
  if (!sort) return rows;
  const cmp = comparators[sort.key];
  const sign = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => sign * cmp(a.row, b.row) || (tieBreak?.(a.row, b.row) ?? 0) || a.i - b.i)
    .map((x) => x.row);
}

// ── Comparator helpers ──────────────────────────────────────────────────────

/** A–Z, case-insensitive; empty values (unassigned) always last. */
export function byText<T>(get: (row: T) => string | null | undefined) {
  return (a: T, b: T) => {
    const x = get(a)?.trim() ?? "", y = get(b)?.trim() ?? "";
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    return x.localeCompare(y, undefined, { sensitivity: "base", numeric: true });
  };
}

/** By a fixed order (e.g. delivery status steps); unknown values last. */
export function byRank<T>(get: (row: T) => string, order: readonly string[]) {
  const rank = (v: string) => { const i = order.indexOf(v); return i === -1 ? order.length : i; };
  return (a: T, b: T) => rank(get(a)) - rank(get(b));
}

/** Earliest first; missing times always last. */
export function byTime<T>(get: (row: T) => string | null | undefined) {
  return (a: T, b: T) => {
    const x = get(a), y = get(b);
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    return new Date(x).getTime() - new Date(y).getTime();
  };
}

/** Groups consecutive rows sharing a label (call on already-sorted rows). */
export function groupRows<T>(rows: T[], label: (row: T) => string): { label: string; rows: T[] }[] {
  const groups: { label: string; rows: T[] }[] = [];
  for (const row of rows) {
    const l = label(row);
    const last = groups[groups.length - 1];
    if (last && last.label === l) last.rows.push(row);
    else groups.push({ label: l, rows: [row] });
  }
  return groups;
}

// ── UI ──────────────────────────────────────────────────────────────────────

const headerText: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.04em",
};

/** A column header; sortable when `sortKey` is given. */
export function SortHeader<K extends string>({
  label, sortKey, sort, onToggle,
}: {
  label: string;
  sortKey?: K;
  sort: SortState<K>;
  onToggle: (key: K) => void;
}) {
  if (!sortKey || !label) return <span style={headerText}>{label}</span>;
  const active = sort?.key === sortKey;
  const next = !active ? "sort" : sort!.dir === "asc" ? "reverse" : "clear sort";
  return (
    <button
      onClick={() => onToggle(sortKey)}
      title={`${label}: click to ${next}`}
      aria-label={`${label}${active ? (sort!.dir === "asc" ? ", sorted" : ", sorted in reverse") : ""}. Click to ${next}.`}
      style={{
        ...headerText, color: active ? "#185FA5" : headerText.color,
        background: "none", border: "none", padding: 0, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 3, textAlign: "left",
      }}
    >
      {label}
      <span aria-hidden style={{ fontSize: 8, opacity: active ? 1 : 0.35 }}>
        {active ? (sort!.dir === "asc" ? "▲" : "▼") : "▲▼"}
      </span>
    </button>
  );
}

/** Thin label between groups when sorted by office or driver. */
export function GroupDivider({ label, count, noun = "job" }: { label: string; count: number; noun?: string }) {
  return (
    <div style={{
      padding: "4px 16px", background: "#F3F5F8", borderBottom: "1px solid rgba(0,0,0,0.05)",
      fontSize: 11.5, color: "#5F5E5A", display: "flex", gap: 6, alignItems: "baseline",
    }}>
      <span style={{ fontWeight: 600, color: "#3a3a3a" }}>{label}</span>
      <span>· {count} {noun}{count === 1 ? "" : "s"}</span>
    </div>
  );
}

/** Phone layouts have no header row: a compact "Sort by" menu instead. */
export function SortMenu<K extends string>({
  options, sort, onChange, defaultLabel,
}: {
  options: { key: K; label: string; reverseLabel: string }[];
  sort: SortState<K>;
  onChange: (next: SortState<K>) => void;
  defaultLabel: string;
}) {
  const value = sort ? `${sort.key}:${sort.dir}` : "";
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5F5E5A" }}>
      Sort
      <select
        value={value}
        onChange={(e) => {
          const [key, dir] = e.target.value.split(":");
          onChange(key ? { key: key as K, dir: dir as "asc" | "desc" } : null);
        }}
        style={{ fontSize: 12.5, padding: "4px 6px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.15)", background: "#fff", color: "#1a1a1a" }}
      >
        <option value="">{defaultLabel}</option>
        {options.flatMap((o) => [
          <option key={`${o.key}:asc`} value={`${o.key}:asc`}>{o.label}</option>,
          <option key={`${o.key}:desc`} value={`${o.key}:desc`}>{o.reverseLabel}</option>,
        ])}
      </select>
    </label>
  );
}
