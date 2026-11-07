import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { inRange, labHasReports, parseRange, planRequired, timeFormatter, toCsv } from "@/lib/reports";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const MAX_ROWS = 100_000;

type Range = { from: string | null; to: string | null };
type Time = (value: unknown) => string;
type Sheet = { header: string[]; rows: unknown[][] };

// Column lists are written out by hand, never select("*"): tracking links,
// access codes and sign-in ids must not end up in a spreadsheet.
const EXPORTS: Record<string, (labId: string, range: Range, time: Time) => Promise<Sheet>> = {
  async jobs(labId, range, time) {
    const rows = await inRange(db("jobs as j"), "j.created_at", range)
      .where("j.lab_id", labId)
      .leftJoin("offices as o", "j.office_id", "o.id")
      .leftJoin("drivers as d", "j.driver_id", "d.id")
      .orderBy("j.created_at", "asc")
      .limit(MAX_ROWS)
      .select("j.case_id", "o.name as office_name", "d.name as driver_name", "j.priority", "j.status", "j.items", "j.pickup_address", "j.delivery_address", "j.created_at", "j.scheduled_at", "j.delivered_at", "j.proof_of_delivery", "j.pod_photo_path");
    return {
      header: ["Case", "Office", "Driver", "Priority", "Status", "Items", "Pickup address", "Delivery address", "Created", "Due", "Delivered", "On time", "Received by", "Photo"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows: rows.map((j: any) => [
        j.caseId, j.officeName, j.driverName, j.priority, j.status,
        (Array.isArray(j.items) ? j.items : []).map((i: { description?: string }) => i?.description).filter(Boolean).join("; "),
        j.pickupAddress, j.deliveryAddress, time(j.createdAt), time(j.scheduledAt), time(j.deliveredAt),
        j.deliveredAt && j.scheduledAt ? (new Date(j.deliveredAt) <= new Date(j.scheduledAt) ? "Yes" : "No") : "",
        j.proofOfDelivery?.recipientName ?? j.proofOfDelivery?.recipient_name ?? "",
        j.podPhotoPath ? "Yes" : "No",
      ]),
    };
  },

  async returns(labId, range, time) {
    const rows = await inRange(db("returns as r"), "r.created_at", range)
      .where("r.lab_id", labId)
      .leftJoin("offices as o", "r.office_id", "o.id")
      .leftJoin("drivers as d", "r.driver_id", "d.id")
      .leftJoin("jobs as sj", "r.source_job_id", "sj.id")
      .orderBy("r.created_at", "asc")
      .limit(MAX_ROWS)
      .select("r.number", "o.name as office_name", "d.name as driver_name", "r.status", "r.case_count", "r.case_numbers", "r.note", "r.requested_at", "r.picked_up_at", "r.dropped_at", "r.checked_in_at", "r.received_count", "r.case_id", "sj.case_id as source_case_id");
    return {
      header: ["Return", "Office", "Driver", "Status", "Cases logged", "Case numbers", "Note", "Requested", "Picked up", "Dropped at lab", "Checked in", "Cases received", "Lab case number", "Came back from"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows: rows.map((r: any) => [
        `RET-${r.number}`, r.officeName, r.driverName, r.status, r.caseCount,
        (Array.isArray(r.caseNumbers) ? r.caseNumbers : []).join("; "), r.note,
        time(r.requestedAt), time(r.pickedUpAt), time(r.droppedAt), time(r.checkedInAt),
        r.receivedCount, r.caseId, r.sourceCaseId,
      ]),
    };
  },

  async messages(labId, range, time) {
    const [jobMessages, returnMessages] = await Promise.all([
      inRange(db("messages as m"), "m.created_at", range)
        .join("jobs as j", "m.job_id", "j.id")
        .leftJoin("offices as o", "j.office_id", "o.id")
        .where("j.lab_id", labId)
        .limit(MAX_ROWS)
        .select("m.created_at", "j.case_id as about", "o.name as office_name", "m.sender_role", "m.body"),
      inRange(db("return_messages as m"), "m.created_at", range)
        .join("returns as r", "m.return_id", "r.id")
        .leftJoin("offices as o", "r.office_id", "o.id")
        .where("m.lab_id", labId)
        .limit(MAX_ROWS)
        .select("m.created_at", db.raw("'RET-' || r.number as about"), "o.name as office_name", "m.sender_role", "m.body"),
    ]);
    const all = [...jobMessages, ...returnMessages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return {
      header: ["Sent", "About", "Office", "From", "Message"],
      rows: all.map((m) => [time(m.createdAt), m.about, m.officeName, m.senderRole, m.body]),
    };
  },

  async drivers(labId) {
    const rows = await db("drivers").where({ lab_id: labId }).orderBy("name", "asc").select("name", "phone", "email", "status");
    return {
      header: ["Name", "Phone", "Email", "Status"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows: rows.map((d: any) => [d.name, d.phone, d.email, d.status]),
    };
  },

  async offices(labId) {
    const rows = await db("offices").where({ lab_id: labId }).orderBy("name", "asc").select("name", "address", "phone", "contact_name");
    return {
      header: ["Name", "Address", "Phone", "Contact"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows: rows.map((o: any) => [o.name, o.address, o.phone, o.contactName]),
    };
  },
};

// GET /api/reports/export?type=jobs|returns|messages|drivers|offices&from=&to=&tz=  (dispatcher, Growth and Pro)
// A CSV of the lab's data. Jobs, returns and messages use the date range; the
// driver and office lists are always complete.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Dispatchers only" } }, { status: 403 });
    }
    if (!(await labHasReports(user.labId))) return planRequired();

    const params = request.nextUrl.searchParams;
    const type = params.get("type") ?? "";
    if (!Object.prototype.hasOwnProperty.call(EXPORTS, type)) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Choose what to export." } }, { status: 400 });
    }
    const range = parseRange(params);
    if (range instanceof Response) return range;

    const sheet = await EXPORTS[type](user.labId, range, timeFormatter(params.get("tz")));
    return new Response(toCsv(sheet.header, sheet.rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gepeto-${type}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/reports/export]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to export" } }, { status: 500 });
  }
}
