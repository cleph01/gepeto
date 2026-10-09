import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/jobs/[id]/messages/read
// Marks the thread read for the current user up to `upTo` (the createdAt of
// the newest message the client actually displayed). Using the client's
// timestamp rather than now() means a message that lands between the
// client's fetch and this call still counts as unread. Never moves backwards.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const job = await db("jobs").where({ id, lab_id: user.labId }).first();
    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    const { upTo } = await request.json().catch(() => ({}));
    const upToDate = upTo ? new Date(upTo) : null;
    if (!upToDate || isNaN(upToDate.getTime())) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "upTo must be a valid timestamp" } },
        { status: 400 }
      );
    }

    await db.raw(
      `INSERT INTO message_reads (user_id, job_id, last_read_at)
       VALUES (?, ?, ?)
       ON CONFLICT (user_id, job_id)
       DO UPDATE SET last_read_at = GREATEST(message_reads.last_read_at, EXCLUDED.last_read_at)`,
      [user.id, id, upToDate.toISOString()]
    );

    return Response.json({ data: { ok: true }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/jobs/[id]/messages/read]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to mark messages read" } },
      { status: 500 }
    );
  }
}
