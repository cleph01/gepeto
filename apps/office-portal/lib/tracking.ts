// Data for the public office tracking page (/t/[token]) and its 30-second
// polling endpoint (/api/track/[token]), so both always send the same shape.
// Delivered history is separate (/api/track/[token]/delivered), loaded only
// when the office opens the Delivered tab.
import { createHmac } from "node:crypto";
import { isUnlocked, officeAccess, officeFromToken } from "./access";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

/** Statuses where the driver is actually carrying the case toward the office. */
export const ON_THE_WAY = ["picked_up", "in_transit", "arrived"];

/** Groups an office's cases by driver without handing out the real driver id. */
const driverKey = (token: string, driverId: string) =>
  createHmac("sha256", token).update(driverId).digest("base64url").slice(0, 16);

// What the link alone gets: who it belongs to and how to reach the lab, so staff
// know they're in the right place. No activity of any kind until the code passes.
async function loadLocked(token: string) {
  const office = await db("offices")
    .leftJoin("labs", "offices.lab_id", "labs.id")
    .where("offices.tracking_token", token)
    .first("offices.name", "labs.name as labName", "labs.phone as labPhone");
  return { locked: true as const, office };
}

/**
 * The page's data for whoever's asking: the full view with a valid access code
 * session, otherwise just the code screen's details. Null for a link that doesn't exist.
 */
export async function loadTrackingForRequest(token: string) {
  const access = await officeFromToken(token);
  if (!access) return null;
  return (await isUnlocked(token, access)) ? loadTracking(token, access.accessVersion) : loadLocked(token);
}

async function loadTracking(token: string, version: number) {
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
      "labs.phone as labPhone",
      "labs.settings as labSettings",
      "labs.subscription_status as labSubscriptionStatus"
    )
    .first();
  if (!office) return null;
  const { labSettings, labSubscriptionStatus, ...officeDetails } = office;
  const readOnly = labSubscriptionStatus === "canceled" || labSubscriptionStatus === "incomplete_expired";
  const alertsAllowed: boolean = labSettings?.notifications?.officeAlerts ?? true;

  const jobs = await db("jobs")
    .leftJoin("drivers", "jobs.driver_id", "drivers.id")
    .where("jobs.office_id", office.id)
    .whereNotIn("jobs.status", ["delivered", "rejected"])
    .orderBy("jobs.created_at", "desc")
    .select(
      "jobs.id",
      "jobs.case_id as caseId",
      "jobs.status",
      "jobs.driver_response as driverResponse",
      "jobs.priority",
      "jobs.delivery_address as deliveryAddress",
      "jobs.delivery_lat as deliveryLat",
      "jobs.delivery_lng as deliveryLng",
      "jobs.items",
      "jobs.created_at as createdAt",
      "jobs.updated_at as updatedAt",
      "jobs.driver_id as driverId",
      "drivers.name as driverName",
      "drivers.current_location as driverLocation",
      "drivers.on_break_since as driverOnBreakSince"
    );

  // Just delivered, so an open page can tell a delivery from a case that merely
  // left the list (moved to another office, say) and alert the front desk.
  const recentlyDelivered = await db("jobs")
    .where("office_id", office.id)
    .where("status", "delivered")
    .where("delivered_at", ">=", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .orderBy("delivered_at", "desc")
    .limit(50)
    .select("id", "case_id as caseId");

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
      // The office hears who's coming only once that driver has accepted.
      db.raw("case when r.driver_response = 'accepted' then d.name end as driver_name")
    );

  // A driver's live location is only shared once they're carrying at least one
  // of this office's cases. Before that the office has no reason to see where
  // the driver is, so it never leaves the server.
  const driversOnTheWay = new Set(
    jobs
      .filter((j: { status: string; driverId: string | null }) => j.driverId && ON_THE_WAY.includes(j.status))
      .map((j: { driverId: string }) => j.driverId)
  );
  // A driver on a break: no location, and the office is told only that it's
  // paused. The break itself never leaves the server.
  for (const j of jobs as {
    driverId: string | null;
    driverKey?: string | null;
    driverLocation: unknown;
    driverOnBreakSince?: unknown;
    locationPaused?: boolean;
  }[]) {
    const onTheWay = !!j.driverId && driversOnTheWay.has(j.driverId);
    j.locationPaused = onTheWay && !!j.driverOnBreakSince;
    if (!onTheWay || j.locationPaused) j.driverLocation = null;
    delete j.driverOnBreakSince;
    j.driverKey = j.driverId ? driverKey(token, j.driverId) : null;
    delete (j as { driverId?: string | null }).driverId;
  }

  return { locked: false as const, office: officeDetails, jobs, recentlyDelivered, pickups, alertsAllowed, readOnly, liveTopic: officeAccess.liveTopic({ token, version }) as string };
}
