import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkDriverRoom } from "@/lib/billing";
import { hideLocationOnBreak } from "@/lib/driver-break";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// PATCH /api/drivers/[id] — update driver name, phone, or status (dispatcher only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can update drivers" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const allowed = ["name", "phone", "status"] as const;
    const updates: Record<string, string> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "No valid fields to update" } },
        { status: 400 }
      );
    }

    // Bringing a driver back from Off Duty takes an active spot on the plan.
    if (updates.status && updates.status !== "off_duty") {
      const current = await db("drivers").where({ id, lab_id: user.labId }).select("status").first();
      if (current?.status === "off_duty") {
        const blocked = await checkDriverRoom(user.labId);
        if (blocked) return blocked;
      }
    }

    const [driver] = await db("drivers")
      .where({ id, lab_id: user.labId })
      .update(updates)
      .returning("*");

    if (!driver) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Driver not found" } },
        { status: 404 }
      );
    }

    return Response.json({ data: hideLocationOnBreak(driver), error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/drivers/[id]]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to update driver" } },
      { status: 500 }
    );
  }
}
