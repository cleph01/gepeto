import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const RECENT_LIMIT = 20;

// Office/driver messages in this lab that the current dispatcher hasn't seen —
// i.e. newer than their message_reads.last_read_at for that job (or any, if
// they've never opened the thread).
function unreadMessages(userId: string, labId: string) {
  return db("messages")
    .join("jobs", "messages.job_id", "jobs.id")
    .joinRaw(
      "LEFT JOIN message_reads ON message_reads.job_id = messages.job_id AND message_reads.user_id = ?",
      [userId]
    )
    .where("jobs.lab_id", labId)
    .whereIn("messages.sender_role", ["office", "driver"])
    // Truncated to ms because last_read_at comes from a JS Date (ms precision)
    // while created_at is stored in µs — otherwise the newest message read
    // would always compare as a few µs newer and never clear.
    .whereRaw(
      "(message_reads.last_read_at IS NULL OR date_trunc('milliseconds', messages.created_at) > message_reads.last_read_at)"
    );
}

// GET /api/messages/unread
// Dispatcher only. Per-job unread counts plus the most recent unread messages
// (used client-side to decide what to toast).
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Dispatchers only" } },
        { status: 403 }
      );
    }

    const [counts, recent] = await Promise.all([
      unreadMessages(user.id, user.labId)
        .groupBy("messages.job_id")
        .select("messages.job_id")
        .count("* as count"),
      unreadMessages(user.id, user.labId)
        .leftJoin("offices", "jobs.office_id", "offices.id")
        .leftJoin("drivers", "jobs.driver_id", "drivers.id")
        .orderBy("messages.created_at", "desc")
        .limit(RECENT_LIMIT)
        .select(
          "messages.id",
          "messages.job_id",
          "messages.sender_role",
          "messages.body",
          "messages.created_at",
          "jobs.case_id",
          "offices.name as office_name",
          "drivers.name as driver_name"
        ),
    ]);

    const byJob: Record<string, number> = {};
    let total = 0;
    for (const row of counts as { jobId: string; count: string | number }[]) {
      const n = Number(row.count);
      byJob[row.jobId] = n;
      total += n;
    }

    return Response.json({ data: { total, byJob, recent }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/messages/unread]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch unread messages" } },
      { status: 500 }
    );
  }
}
