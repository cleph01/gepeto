import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { MAX_MESSAGE_LENGTH, announceReturnMessage, returnForViewer, whyClosed } from "@/lib/return-messages";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const COLUMNS = ["id", "return_id", "sender_role", "body", "created_at"];
const notFound = () => Response.json({ data: null, error: { code: "NOT_FOUND", message: "Return not found" } }, { status: 404 });

// GET /api/returns/[id]/messages  (lab, or the driver who has it)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const ret = await returnForViewer(user, id);
    if (!ret) return notFound();

    const messages = await db("return_messages").where("return_id", id).orderBy("created_at", "asc").select(COLUMNS);
    return Response.json({ data: messages, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/returns/[id]/messages]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch messages" } }, { status: 500 });
  }
}

// POST /api/returns/[id]/messages  (lab, or the driver who has it)
// Body: { body }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const ret = await returnForViewer(user, id);
    if (!ret) return notFound();

    const closed = whyClosed(ret.status, user.role);
    if (closed) return Response.json({ data: null, error: { code: "CONFLICT", message: closed } }, { status: 409 });

    const { body } = await request.json().catch(() => ({}));
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!trimmed) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Message body is required" } }, { status: 400 });
    }
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Message is too long" } }, { status: 400 });
    }

    const [message] = await db("return_messages")
      .insert({ return_id: id, lab_id: user.labId, sender_role: user.role, sender_id: user.id, body: trimmed })
      .returning(COLUMNS);

    await announceReturnMessage({ id, labId: user.labId, officeId: ret.officeId, driverId: ret.driverId });
    return Response.json({ data: message, error: null }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/returns/[id]/messages]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to send message" } }, { status: 500 });
  }
}
