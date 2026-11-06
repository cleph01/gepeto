// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// When a driver's location is shared with their lab: once they've accepted a
// job or pickup, or while they're carrying cases. Offices have a stricter rule
// (see ON_THE_WAY in office-portal/lib/tracking.ts).
function workingJobs(labId: string) {
  return db("jobs")
    .where("lab_id", labId)
    .whereNotNull("driver_id")
    .where((w: typeof db) =>
      w.whereIn("status", ["picked_up", "in_transit", "arrived"])
        .orWhere((a: typeof db) => a.where("status", "assigned").where("driver_response", "accepted"))
    );
}

function workingReturns(labId: string) {
  return db("returns")
    .where("lab_id", labId)
    .whereNotNull("driver_id")
    .where((w: typeof db) =>
      w.where("status", "with_driver")
        .orWhere((a: typeof db) => a.where("status", "requested").where("driver_response", "accepted"))
    );
}

/** Drivers in this lab whose location the lab may see. */
export async function driversSharingLocation(labId: string): Promise<Set<string>> {
  const [jobs, returns]: { driverId: string }[][] = await Promise.all([
    workingJobs(labId).distinct("driver_id"),
    workingReturns(labId).distinct("driver_id"),
  ]);
  return new Set([...jobs, ...returns].map((r) => r.driverId));
}

export async function driverSharesLocation(driverId: string, labId: string): Promise<boolean> {
  const [job, ret] = await Promise.all([
    workingJobs(labId).where("driver_id", driverId).first("id"),
    workingReturns(labId).where("driver_id", driverId).first("id"),
  ]);
  return !!job || !!ret;
}
