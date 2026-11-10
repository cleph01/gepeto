import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { officeForDispatcher, officeNotFound, officeThread } from "@/lib/direct-messages";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/direct-messages/offices/[id]/read
// Body: { upTo }, the createdAt of the newest message shown. Same rules as
// /api/jobs/[id]/messages/read: the client's time, never moving backwards.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const office = await officeForDispatcher(user, id);
    if (!office) return officeNotFound();

    const { upTo } = await request.json().catch(() => ({}));
    const upToDate = upTo ? new Date(upTo) : null;
    if (!upToDate || isNaN(upToDate.getTime())) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "upTo must be a valid timestamp" } }, { status: 400 });
    }

    await db.raw(
      `INSERT INTO direct_message_reads (user_id, thread, last_read_at)
       VALUES (?, ?, ?)
       ON CONFLICT (user_id, thread)
       DO UPDATE SET last_read_at = GREATEST(direct_message_reads.last_read_at, EXCLUDED.last_read_at)`,
      [user.id, officeThread(office.id), upToDate.toISOString()]
    );
    return Response.json({ data: { ok: true }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/direct-messages/offices/[id]/read]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to mark messages read" } }, { status: 500 });
  }
}
