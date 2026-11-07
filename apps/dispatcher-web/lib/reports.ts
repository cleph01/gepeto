// Shared rules for Reports and data export.
import { PLANS, isPlanId } from "@/lib/plans";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

/** On Growth and Pro. Labs with no plan (created before billing, or comped) have everything. */
export async function labHasReports(labId: string): Promise<boolean> {
  const lab = await db("labs").where({ id: labId }).select("plan").first();
  return !(isPlanId(lab?.plan) && PLANS[lab.plan as keyof typeof PLANS] === PLANS.starter);
}

export const planRequired = () =>
  Response.json({ data: null, error: { code: "PLAN_REQUIRED", message: "Reports and data export are on the Growth and Pro plans." } }, { status: 403 });

/** Optional ?from= and ?to= (ISO times). Neither means all time. */
export function parseRange(params: URLSearchParams): { from: string | null; to: string | null } | Response {
  const read = (name: string) => {
    const raw = params.get(name);
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  };
  const from = read("from");
  const to = read("to");
  if (from === undefined || to === undefined || (from && to && from >= to)) {
    return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Choose a valid date range." } }, { status: 400 });
  }
  return { from, to };
}

/** Applies the range to one timestamp column of a query. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function inRange(q: any, column: string, range: { from: string | null; to: string | null }) {
  if (range.from) q.where(column, ">=", range.from);
  if (range.to) q.where(column, "<", range.to);
  return q;
}

// Spreadsheets run a cell starting with these as a formula, and these cells can
// hold text typed by an office or driver. A leading apostrophe keeps it as text.
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** With a byte order mark, so Excel reads accented names correctly. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Formats times in the lab's own time zone (the browser sends it), falling back to UTC. */
export function timeFormatter(timeZone: string | null): (value: unknown) => string {
  let fmt: Intl.DateTimeFormat;
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  try {
    fmt = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: timeZone ?? "UTC" });
  } catch {
    fmt = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "UTC" });
  }
  return (value) => {
    if (!value) return "";
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? "" : fmt.format(d).replace(",", "");
  };
}
