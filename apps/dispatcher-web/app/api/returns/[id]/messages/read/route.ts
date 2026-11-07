import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { returnForViewer } from "@/lib/return-messages";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/returns/[id]/messages/read
// Marks the conversation read up to `upTo`, the createdAt of the newest message
// shown. Never moves backwards. Same rules as job messages.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const ret = await returnForViewer(user, id);
    if (!ret) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Return not found" } }, { status: 404 });
    }

    const { upTo } = await request.json().catch(() => ({}));
    const upToDate = upTo ? new Date(upTo) : null;
    if (!upToDate || isNaN(upToDate.getTime())) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "upTo must be a valid timestamp" } }, { status: 400 });
    }

    await db.raw(
      `INSERT INTO return_message_reads (user_id, return_id, last_read_at)
       VALUES (?, ?, ?)
       ON CONFLICT (user_id, return_id)
       DO UPDATE SET last_read_at = GREATEST(return_message_reads.last_read_at, EXCLUDED.last_read_at)`,
      [user.id, id, upToDate.toISOString()]
    );
    return Response.json({ data: { ok: true }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/returns/[id]/messages/read]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to mark messages read" } }, { status: 500 });
  }
}
