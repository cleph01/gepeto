import type { NextRequest } from "next/server";
import { rateLimited, requireUnlocked } from "@/lib/access";
import { notifyDriverReturnMessage, notifyLab, notifyOfficePage } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const MAX_BODY_LENGTH = 2000;
const COLUMNS = ["id", "sender_role", "body", "created_at"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The return if it's this office's and the code was entered; otherwise the Response to send. */
async function resolveReturn(token: string, id: string) {
  const office = await requireUnlocked(token);
  if (office instanceof Response) return office;

  const ret = UUID.test(id)
    ? await db("returns").where({ id, office_id: office.id }).select("id", "lab_id", "driver_id", "status").first()
    : null;
  if (ret) return { ...ret, accessVersion: office.accessVersion };
  return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Pickup not found" } }, { status: 404 });
}

// GET /api/track/[token]/pickups/[id]/messages
// Behind the access code, scoped to one return of this office's.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    const ret = await resolveReturn(token, id);
    if (ret instanceof Response) return ret;

    const messages = await db("return_messages").where("return_id", id).orderBy("created_at", "asc").select(COLUMNS);
    return Response.json({ data: messages, error: null });
  } catch (err) {
    console.error("[GET /api/track/[token]/pickups/[id]/messages]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load messages" } }, { status: 500 });
  }
}

// POST /api/track/[token]/pickups/[id]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    const ret = await resolveReturn(token, id);
    if (ret instanceof Response) return ret;

    const limited = await rateLimited(request, token, "message", 60, 10 * 60);
    if (limited) return limited;

    if (ret.status === "cancelled") {
      return Response.json({ data: null, error: { code: "CONFLICT", message: "This pickup was cancelled, so its messages are closed." } }, { status: 409 });
    }

    const { body } = await request.json().catch(() => ({}));
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!trimmed) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Message body is required" } }, { status: 400 });
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Message is too long" } }, { status: 400 });
    }

    const [message] = await db("return_messages")
      .insert({ return_id: id, lab_id: ret.labId, sender_role: "office", sender_id: null, body: trimmed })
      .returning(COLUMNS);

    await notifyLab(ret.labId, "return_message", { returnId: id });
    await notifyOfficePage(token, ret.accessVersion, "messages");
    if (ret.driverId) await notifyDriverReturnMessage(ret.driverId, { returnId: id });

    return Response.json({ data: message, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/track/[token]/pickups/[id]/messages]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to send message" } }, { status: 500 });
  }
}
