import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/settings — returns lab info + current user profile
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const [lab, labUser] = await Promise.all([
      db("labs").where({ id: user.labId }).first(),
      db("lab_users").where({ lab_id: user.labId, user_id: user.id }).first(),
    ]);

    if (!lab) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Lab not found" } },
        { status: 404 }
      );
    }

    const settings = lab.settings ?? {};

    return Response.json({
      data: {
        lab: {
          name:                 lab.name,
          address:              lab.address,
          city:                 settings.city                 ?? "",
          state:                settings.state                ?? "",
          zip:                  settings.zip                  ?? "",
          phone:                lab.phone,
          timezone:             settings.timezone             ?? "America/Los_Angeles",
          operatingHoursStart:  settings.operatingHoursStart  ?? "07:00",
          operatingHoursEnd:    settings.operatingHoursEnd    ?? "18:00",
        },
        notifications: {
          statJobAlert:      settings.notifications?.statJobAlert      ?? true,
          unassignedAlert:   settings.notifications?.unassignedAlert   ?? true,
          unassignedMinutes: settings.notifications?.unassignedMinutes ?? "15",
          lateDeliveryAlert: settings.notifications?.lateDeliveryAlert ?? true,
          lateDeliveryMins:  settings.notifications?.lateDeliveryMins  ?? "30",
          driverOffDuty:     settings.notifications?.driverOffDuty     ?? false,
        },
        profile: {
          name:  labUser?.name    ?? "",
          email: labUser?.email   ?? "",
          role:  labUser?.labRole ?? "dispatcher",
          phone: labUser?.phone   ?? "",
        },
      },
      error: null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/settings]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load settings" } },
      { status: 500 }
    );
  }
}
