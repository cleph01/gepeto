import type { NextRequest } from "next/server";
import { driversSharingLocation } from "@/lib/driver-sharing";
import { requireAuth } from "@/lib/auth";
import { formatPhoneInput, phoneError } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase";
import { delivered, getDashboardUrl, sendInviteEmail } from "@/lib/email";
import { checkDriverRoom } from "@/lib/billing";
import { breakFlagMins, hideLocationOnBreak } from "@/lib/driver-break";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/drivers — list all drivers for the lab
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can view drivers" } },
        { status: 403 }
      );
    }

    const [drivers, lab] = await Promise.all([
      db("drivers").where("lab_id", user.labId).orderBy("name", "asc").select("*"),
      db("labs").where({ id: user.labId }).first("settings"),
    ]);
    const flagAfterMins = breakFlagMins(lab?.settings);

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

    const sharing = await driversSharingLocation(user.labId);
    const enriched = drivers.map((d: { id: string; onBreakSince: string | null; currentLocation: unknown }) => ({
      ...hideLocationOnBreak(d),
      // No accepted work: no pin, even if a last location is still on file.
      ...(sharing.has(d.id) ? null : { currentLocation: null }),
      activeJobs: countMap[d.id] ?? 0,
      breakFlagMins: flagAfterMins,
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

    const phoneMsg = phoneError(phone);
    if (phoneMsg) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: phoneMsg } }, { status: 400 });
    }

    // Adding an active driver takes a spot on the plan (Off Duty ones don't).
    if ((status ?? "available") !== "off_duty") {
      const blocked = await checkDriverRoom(user.labId);
      if (blocked) return blocked;
    }

    // 1. Create DB row first so we have the driver ID for app_metadata
    const [driver] = await db("drivers")
      .insert({
        lab_id: user.labId,
        name:   name.trim(),
        phone:  formatPhoneInput(phone),
        email:  email.trim().toLowerCase(),
        status: status ?? "available",
      })
      .returning("*");

    driverId = driver.id;

    // 2. Generate invite link (creates Supabase Auth user without sending email),
    //    then send via Resend to bypass Supabase's rate-limited built-in mailer.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: email.trim().toLowerCase(),
      options: {
        data: { name: name.trim() }, // stored in user_metadata (display purposes)
        redirectTo: `${getDashboardUrl()}/accept-invite`,
      },
    });

    if (linkError || !linkData?.user) {
      // Rollback DB row
      await db("drivers").where({ id: driverId }).delete();
      console.error("[POST /api/drivers] Supabase generateLink failed:", linkError?.message);
      return Response.json(
        { data: null, error: { code: "AUTH_ERROR", message: linkError?.message ?? "Failed to send invite" } },
        { status: 500 }
      );
    }

    // The account is created either way; if the email fails, the dispatcher sees
    // it and can use Resend invite rather than the driver waiting on nothing.
    // Lab name only personalizes the email; a lookup failure must not block the invite.
    const lab = await db("labs").where({ id: user.labId }).first("name").catch(() => null);
    const inviteSent = await delivered(
      sendInviteEmail(email.trim().toLowerCase(), {
        name: name.trim(),
        inviteUrl: linkData.properties.action_link,
        role: "driver",
        labName: lab?.name,
      }),
      "[POST /api/drivers] invite",
    );

    const authData = { user: linkData.user };

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
      data: { ...driver, user_id: authData.user.id, activeJobs: 0, inviteSent },
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
