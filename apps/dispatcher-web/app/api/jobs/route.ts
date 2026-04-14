import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { geocodeAddress } from "@/lib/geocode";
import { sendStatJobAlert, getDispatcherEmails, getDashboardUrl } from "@/lib/email";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/jobs
// Dispatcher: returns all jobs for the lab.
// Driver: returns jobs assigned to them.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const query = db("jobs")
      .leftJoin("offices", "jobs.office_id", "offices.id")
      .leftJoin("drivers", "jobs.driver_id", "drivers.id")
      .where("jobs.lab_id", user.labId)
      .orderBy("jobs.created_at", "desc")
      .select(
        "jobs.*",
        "offices.name as office_name",
        "drivers.name as driver_name"
      );

    if (user.role === "driver") {
      query.where("jobs.driver_id", user.driverId);
    }

    const jobs = await query;
    return Response.json({ data: jobs, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/jobs]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch jobs" } },
      { status: 500 }
    );
  }
}

// POST /api/jobs — dispatcher only
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can create jobs" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { caseId, officeId, driverId, priority, items, pickupAddress, deliveryAddress } = body;

    if (!caseId || !officeId || !pickupAddress || !deliveryAddress) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    // Geocode delivery address — fire-and-forget safe (null on failure)
    const coords = await geocodeAddress(deliveryAddress);

    const [job] = await db("jobs")
      .insert({
        case_id: caseId,
        lab_id: user.labId,
        office_id: officeId,
        driver_id: driverId ?? null,
        status: driverId ? "assigned" : "pending",
        priority: priority ?? "standard",
        items: JSON.stringify(items ?? []),
        pickup_address: pickupAddress,
        delivery_address: deliveryAddress,
        delivery_lat: coords?.lat ?? null,
        delivery_lng: coords?.lng ?? null,
      })
      .returning("*");

    // Send STAT alert (fire-and-forget — don't block the response)
    if ((priority ?? "standard") === "stat" && process.env.RESEND_API_KEY) {
      const [to, lab] = await Promise.all([
        getDispatcherEmails(user.labId),
        db("labs").where({ id: user.labId }).select("name").first(),
      ]);
      const office = await db("offices").where({ id: officeId }).select("name").first();
      if (to.length > 0) {
        sendStatJobAlert(to, {
          caseId,
          officeName: office?.name ?? "Unknown Office",
          deliveryAddress,
          labName: lab?.name ?? "Your Lab",
          dashboardUrl: `${getDashboardUrl()}/jobs`,
        }).catch((e) => console.error("[email] STAT alert failed:", e));
      }
    }

    return Response.json({ data: job, error: null }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/jobs]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to create job" } },
      { status: 500 }
    );
  }
}
