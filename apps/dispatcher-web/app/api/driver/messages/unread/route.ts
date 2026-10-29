import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/driver/messages/unread
// Per-job unread counts for the signed-in driver: lab and office messages on
// jobs currently assigned to them, newer than the driver's message_reads row
// for that job (same table and rules as the dispatcher's /api/messages/unread).
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "driver") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Drivers only" } },
        { status: 403 }
      );
    }

    const rows = await db("messages")
      .join("jobs", "messages.job_id", "jobs.id")
      .joinRaw(
        "LEFT JOIN message_reads ON message_reads.job_id = messages.job_id AND message_reads.user_id = ?",
        [user.id]
      )
      .where({ "jobs.lab_id": user.labId, "jobs.driver_id": user.driverId })
      .whereIn("messages.sender_role", ["office", "dispatcher"])
      // ms truncation: see /api/messages/unread
      .whereRaw(
        "(message_reads.last_read_at IS NULL OR date_trunc('milliseconds', messages.created_at) > message_reads.last_read_at)"
      )
      .groupBy("messages.job_id")
      .select("messages.job_id")
      .count("* as count");

    const byJob: Record<string, number> = {};
    for (const row of rows as { jobId: string; count: string | number }[]) {
      byJob[row.jobId] = Number(row.count);
    }

    return Response.json({ data: { byJob }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/driver/messages/unread]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch unread messages" } },
      { status: 500 }
    );
  }
}
