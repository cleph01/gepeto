// Data for the public office tracking page (/t/[token]) and its 30-second
// polling endpoint (/api/track/[token]), so both always send the same shape.
// Delivered history is separate (/api/track/[token]/delivered), loaded only
// when the office opens the Delivered tab.
import { createHmac } from "node:crypto";
import { isUnlocked, officeFromToken } from "./access";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

/** Statuses where the driver is actually carrying the case toward the office. */
export const ON_THE_WAY = ["picked_up", "in_transit", "arrived"];

/** Groups an office's cases by driver without handing out the real driver id. */
const driverKey = (token: string, driverId: string) =>
  createHmac("sha256", token).update(driverId).digest("base64url").slice(0, 16);

// What the link alone shows, with no access code: case numbers and status.
// No driver, location, address, items, messages, pickups or history.
async function loadLocked(token: string) {
  const office = await db("offices")
    .leftJoin("labs", "offices.lab_id", "labs.id")
    .where("offices.tracking_token", token)
    .first("offices.name", "labs.name as labName", "labs.phone as labPhone");
  const jobs = await db("jobs")
    .join("offices", "jobs.office_id", "offices.id")
    .where("offices.tracking_token", token)
    .whereNotIn("jobs.status", ["delivered", "rejected"])
    .orderBy("jobs.created_at", "desc")
    .select(
      "jobs.case_id as caseId",
      "jobs.status",
      "jobs.priority",
      db.raw("(jobs.driver_id is not null) as has_driver"),
      "jobs.scheduled_at as scheduledAt",
      "jobs.updated_at as updatedAt"
    );
  return { locked: true as const, office, jobs };
}

/**
 * The page's data for whoever's asking: the full view with a valid access code
 * session, otherwise the basic one. Null for a link that doesn't exist.
 */
export async function loadTrackingForRequest(token: string) {
  const access = await officeFromToken(token);
  if (!access) return null;
  return (await isUnlocked(token, access)) ? loadTracking(token) : loadLocked(token);
}

async function loadTracking(token: string) {
  const office = await db("offices")
    .leftJoin("labs", "offices.lab_id", "labs.id")
    .where("offices.tracking_token", token)
    .select(
      "offices.id",
      "offices.name",
      "offices.address",
      "offices.phone",
      "offices.contact_name as contactName",
      "labs.name as labName",
      "labs.phone as labPhone"
    )
    .first();
  if (!office) return null;

  const jobs = await db("jobs")
    .leftJoin("drivers", "jobs.driver_id", "drivers.id")
    .where("jobs.office_id", office.id)
    .whereNotIn("jobs.status", ["delivered", "rejected"])
    .orderBy("jobs.created_at", "desc")
    .select(
      "jobs.id",
      "jobs.case_id as caseId",
      "jobs.status",
      "jobs.priority",
      "jobs.delivery_address as deliveryAddress",
      "jobs.delivery_lat as deliveryLat",
      "jobs.delivery_lng as deliveryLng",
      "jobs.items",
      "jobs.created_at as createdAt",
      "jobs.updated_at as updatedAt",
      "jobs.driver_id as driverId",
      "drivers.name as driverName",
      "drivers.current_location as driverLocation"
    );

  // The office's pickup requests and returns still moving, plus anything
  // checked in during the last day, so the office sees it land.
  const pickups = await db("returns as r")
    .leftJoin("drivers as d", "r.driver_id", "d.id")
    .where("r.office_id", office.id)
    .where((w: typeof db) =>
      w.whereIn("r.status", ["requested", "with_driver", "at_lab"])
        .orWhere("r.checked_in_at", ">=", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    )
    .orderByRaw("COALESCE(r.requested_at, r.picked_up_at, r.created_at) DESC")
    .limit(30)
    .select(
      "r.id",
      "r.number",
      "r.status",
      "r.case_count as caseCount",
      "r.case_numbers as caseNumbers",
      "r.note",
      "r.requested_at as requestedAt",
      "r.ready_at as readyAt",
      "r.picked_up_at as pickedUpAt",
      "r.checked_in_at as checkedInAt",
      db.raw("(r.driver_id is not null) as has_driver"),
      "d.name as driverName"
    );

  // A driver's live location is only shared once they're carrying at least one
  // of this office's cases. Before that the office has no reason to see where
  // the driver is, so it never leaves the server.
  const driversOnTheWay = new Set(
    jobs
      .filter((j: { status: string; driverId: string | null }) => j.driverId && ON_THE_WAY.includes(j.status))
      .map((j: { driverId: string }) => j.driverId)
  );
  for (const j of jobs as { driverId: string | null; driverKey?: string | null; driverLocation: unknown }[]) {
    if (!j.driverId || !driversOnTheWay.has(j.driverId)) j.driverLocation = null;
    j.driverKey = j.driverId ? driverKey(token, j.driverId) : null;
    delete (j as { driverId?: string | null }).driverId;
  }

  return { locked: false as const, office, jobs, pickups };
}
