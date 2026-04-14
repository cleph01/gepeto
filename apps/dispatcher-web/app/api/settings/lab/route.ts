import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// PATCH /api/settings/lab — update lab name, address, phone, and settings JSONB fields
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can update lab info" } },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Fetch current settings to merge into
    const lab = await db("labs").where({ id: user.labId }).first();
    if (!lab) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Lab not found" } },
        { status: 404 }
      );
    }

    const currentSettings = lab.settings ?? {};

    const updates: Record<string, unknown> = {};
    if (body.name    !== undefined) updates.name    = body.name;
    if (body.address !== undefined) updates.address = body.address;
    if (body.phone   !== undefined) updates.phone   = body.phone;

    // Merge JSONB settings fields
    const settingsKeys = ["city", "state", "zip", "timezone", "operatingHoursStart", "operatingHoursEnd"] as const;
    const newSettings: Record<string, unknown> = { ...currentSettings };
    for (const key of settingsKeys) {
      if (body[key] !== undefined) newSettings[key] = body[key];
    }
    updates.settings = newSettings;

    if (Object.keys(updates).length === 1) {
      // only settings key, no actual change
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "No valid fields to update" } },
        { status: 400 }
      );
    }

    const [updated] = await db("labs")
      .where({ id: user.labId })
      .update(updates)
      .returning("*");

    const s = updated.settings ?? {};
    return Response.json({
      data: {
        name:                updated.name,
        address:             updated.address,
        city:                s.city                 ?? "",
        state:               s.state                ?? "",
        zip:                 s.zip                  ?? "",
        phone:               updated.phone,
        timezone:            s.timezone             ?? "America/Los_Angeles",
        operatingHoursStart: s.operatingHoursStart  ?? "07:00",
        operatingHoursEnd:   s.operatingHoursEnd    ?? "18:00",
      },
      error: null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/settings/lab]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to update lab" } },
      { status: 500 }
    );
  }
}
