// Shared query + shape for returning cases (see the returns migration).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

export type ReturnStatus = "requested" | "with_driver" | "at_lab" | "checked_in" | "cancelled";

/** Returns (and pickup requests) with their office, driver and linked job case numbers, newest first. */
export function returnsQuery(labId: string) {
  return db("returns as r")
    .leftJoin("offices as o", "r.office_id", "o.id")
    .leftJoin("drivers as d", "r.driver_id", "d.id")
    .leftJoin("jobs as pj", "r.picked_up_during_job_id", "pj.id")
    .leftJoin("jobs as sj", "r.source_job_id", "sj.id")
    .where("r.lab_id", labId)
    .select(
      "r.*",
      "o.name as office_name",
      "o.address as office_address",
      "d.name as driver_name",
      "pj.case_id as picked_up_during_case_id",
      "sj.case_id as source_case_id"
    )
    // Requests haven't been picked up yet; they sort by when they were asked for.
    .orderByRaw("COALESCE(r.picked_up_at, r.requested_at, r.created_at) DESC");
}

/** RET-1042 */
export const returnLabel = (number: number) => `RET-${number}`;

/** Normalizes driver-typed case numbers: trimmed, uppercased, no blanks or repeats, at most 50. */
export function cleanCaseNumbers(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const v of input) {
    if (typeof v !== "string") continue;
    const s = v.trim().toUpperCase().slice(0, 64);
    if (s) seen.add(s);
  }
  return [...seen].slice(0, 50);
}

export const MAX_RETURN_CASES = 99;

/**
 * A return's lab case numbers from the check-in or edit boxes, joined for
 * returns.case_id ("LAB-2042, RET-1085-2"). A blank box gets a Gepeto number
 * from the return: RET-1085, or RET-1085-1, RET-1085-2 when there are several.
 * Returns null when they don't fit in the column.
 */
export function joinCaseIds(input: unknown, returnNumber: number): string | null {
  const raw: unknown[] = Array.isArray(input) && input.length > 0 ? input.slice(0, MAX_RETURN_CASES) : [""];
  const generated = (i: number) => (raw.length === 1 ? `RET-${returnNumber}` : `RET-${returnNumber}-${i + 1}`);
  // Commas separate the numbers in case_id, so one can't be part of a number.
  const clean = (v: unknown) => (typeof v === "string" ? v.replace(/,/g, " ").trim().slice(0, 64) : "");
  const joined = [...new Set(raw.map((v, i) => clean(v) || generated(i)))].join(", ");
  return joined.length > 255 ? null : joined;
}

/** The numbers stored by joinCaseIds, as a list. */
export const splitCaseIds = (caseId: string | null) => (caseId ? caseId.split(", ").filter(Boolean) : []);
