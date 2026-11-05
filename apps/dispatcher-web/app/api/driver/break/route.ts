import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { officesCarriedFor } from "@/lib/driver-break";
import { notifyLab, notifyOffices } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const forbidden = () =>
  Response.json(
    { data: null, error: { code: "FORBIDDEN", message: "Only drivers can take a break" } },
    { status: 403 }
  );
const notFound = () =>
  Response.json(
    { data: null, error: { code: "NOT_FOUND", message: "Driver not found" } },
    { status: 404 }
  );

// GET /api/driver/break — is this driver on a break? Returns { onBreakSince }.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "driver") return forbidden();

    const driver = await db("drivers").where({ id: user.driverId, lab_id: user.labId }).first("on_break_since");
    if (!driver) return notFound();
    return Response.json({ data: { onBreakSince: driver.onBreakSince }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/driver/break]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load break" } },
      { status: 500 }
    );
  }
}

// POST /api/driver/break — { onBreak: boolean }. Starting twice keeps the first
// start time. Saved here, not on the phone, so restarting the app can't resume
// sharing, and only this route ends a break.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "driver") return forbidden();

    const { onBreak } = await request.json();
    if (typeof onBreak !== "boolean") {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "onBreak must be true or false" } },
        { status: 400 }
      );
    }

    const [driver] = await db("drivers")
      .where({ id: user.driverId, lab_id: user.labId })
      .update({ on_break_since: onBreak ? db.raw("COALESCE(on_break_since, now())") : null })
      .returning("on_break_since");
    if (!driver) return notFound();

    await Promise.all([
      notifyLab(user.labId, "driver_changed", { driverId: user.driverId }),
      notifyOffices(await officesCarriedFor(user.driverId!, user.labId), "location"),
    ]);

    return Response.json({ data: { onBreakSince: driver.onBreakSince }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/driver/break]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to update break" } },
      { status: 500 }
    );
  }
}
