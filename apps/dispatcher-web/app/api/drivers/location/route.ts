import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { officesCarriedFor } from "@/lib/driver-break";
import { notifyOffices } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// PATCH /api/drivers/location
// Driver pushes their current GPS coordinates.
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "driver") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only drivers can update location" } },
        { status: 403 }
      );
    }

    const { lat, lng } = await request.json();

    if (typeof lat !== "number" || typeof lng !== "number") {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "lat and lng must be numbers" } },
        { status: 400 }
      );
    }

    const location = { lat, lng, updatedAt: new Date().toISOString() };

    const [driver] = await db("drivers")
      .where({ id: user.driverId, lab_id: user.labId })
      .whereNull("on_break_since")
      .update({ current_location: JSON.stringify(location) })
      .returning("*");

    if (!driver) {
      // A ping from a phone that hasn't heard about the break yet: dropped.
      const onBreak = await db("drivers")
        .where({ id: user.driverId, lab_id: user.labId })
        .whereNotNull("on_break_since")
        .first("id");
      if (onBreak) return Response.json({ data: { location: null }, error: null });
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Driver not found" } },
        { status: 404 }
      );
    }

    await notifyOffices(await officesCarriedFor(user.driverId!, user.labId), "location");

    return Response.json({ data: { location }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/drivers/location]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to update location" } },
      { status: 500 }
    );
  }
}
