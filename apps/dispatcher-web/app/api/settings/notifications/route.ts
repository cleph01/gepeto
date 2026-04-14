import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// PATCH /api/settings/notifications — update notification preferences
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can update settings" } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const lab = await db("labs").where({ id: user.labId }).first();
    if (!lab) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Lab not found" } },
        { status: 404 }
      );
    }

    const currentSettings = lab.settings ?? {};
    const currentNotifs   = currentSettings.notifications ?? {};

    const allowed = ["statJobAlert", "unassignedAlert", "unassignedMinutes", "lateDeliveryAlert", "lateDeliveryMins", "driverOffDuty"] as const;
    const newNotifs: Record<string, unknown> = { ...currentNotifs };
    for (const key of allowed) {
      if (body[key] !== undefined) newNotifs[key] = body[key];
    }

    const newSettings = { ...currentSettings, notifications: newNotifs };

    await db("labs").where({ id: user.labId }).update({ settings: newSettings });

    return Response.json({ data: newNotifs, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/settings/notifications]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to update notifications" } },
      { status: 500 }
    );
  }
}
