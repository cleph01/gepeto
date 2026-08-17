import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getDashboardUrl } from "@/lib/email";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/drivers — list all drivers for the lab
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const drivers = await db("drivers")
      .where("lab_id", user.labId)
      .orderBy("name", "asc")
      .select("*");

    // Enrich with active job count
    const activeJobCounts: { driverId: string; count: string }[] = await db("jobs")
      .where("lab_id", user.labId)
      .whereIn("status", ["assigned", "picked_up", "in_transit", "arrived"])
      .whereNotNull("driver_id")
      .groupBy("driver_id")
      .select("driver_id", db.raw("count(*) as count"));

    const countMap = Object.fromEntries(
      activeJobCounts.map((r) => [r.driverId, Number(r.count)])
    );

    const enriched = drivers.map((d: { id: string }) => ({
      ...d,
      activeJobs: countMap[d.id] ?? 0,
    }));

    return Response.json({ data: enriched, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/drivers]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch drivers" } },
      { status: 500 }
    );
  }
}

// POST /api/drivers — create driver DB row + Supabase Auth account (dispatcher only)
export async function POST(request: NextRequest) {
  let driverId: string | null = null;

  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can add drivers" } },
        { status: 403 }
      );
    }

    const { name, phone, email, status } = await request.json();

    if (!name?.trim() || !phone?.trim() || !email?.trim()) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "name, phone, and email are required" } },
        { status: 400 }
      );
    }

    // 1. Create DB row first so we have the driver ID for app_metadata
    const [driver] = await db("drivers")
      .insert({
        lab_id: user.labId,
        name:   name.trim(),
        phone:  phone.trim(),
        email:  email.trim().toLowerCase(),
        status: status ?? "available",
      })
      .returning("*");

    driverId = driver.id;

    // 2. Create Supabase Auth user and send invite email
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email.trim().toLowerCase(),
      {
        data: { name: name.trim() }, // stored in user_metadata (display purposes)
        redirectTo: `${getDashboardUrl()}/accept-invite`,
      }
    );

    if (authError || !authData?.user) {
      // Rollback DB row
      await db("drivers").where({ id: driverId }).delete();
      console.error("[POST /api/drivers] Supabase invite failed:", authError?.message);
      return Response.json(
        { data: null, error: { code: "AUTH_ERROR", message: authError?.message ?? "Failed to send invite" } },
        { status: 500 }
      );
    }

    // 3. Set app_metadata so RLS policies and requireAuth work correctly
    await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
      app_metadata: {
        role:      "driver",
        lab_id:    user.labId,
        driver_id: driver.id,
      },
    });

    // 4. Store the Supabase user ID on the driver row
    await db("drivers").where({ id: driver.id }).update({ user_id: authData.user.id });

    return Response.json({
      data: { ...driver, user_id: authData.user.id, activeJobs: 0 },
      error: null,
    }, { status: 201 });
  } catch (err) {
    // Rollback driver row if auth provisioning threw unexpectedly
    if (driverId) {
      await db("drivers").where({ id: driverId }).delete().catch(() => null);
    }
    if (err instanceof Response) return err;
    console.error("[POST /api/drivers]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to add driver" } },
      { status: 500 }
    );
  }
}
