// Shared query + shape for returning cases (see the returns migration).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

export type ReturnStatus = "with_driver" | "at_lab" | "checked_in";

/** Returns with their office, driver and linked job case numbers, newest first. */
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
    .orderBy("r.picked_up_at", "desc");
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
