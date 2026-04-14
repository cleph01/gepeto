import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
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
      .update({ current_location: JSON.stringify(location) })
      .returning("*");

    if (!driver) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Driver not found" } },
        { status: 404 }
      );
    }

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
