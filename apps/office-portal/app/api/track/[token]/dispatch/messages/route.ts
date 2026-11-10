import type { NextRequest } from "next/server";
import { rateLimited, refuseIfReadOnly, requireUnlocked } from "@/lib/access";
import { notifyLab, notifyOfficePage } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const MAX_BODY_LENGTH = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The office's private thread with the lab's dispatch. Drivers never see it.
// Behind the access code, and only ever this office's own thread.

// GET /api/track/[token]/dispatch/messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const office = await requireUnlocked(token);
    if (office instanceof Response) return office;

    const messages = await db("direct_messages as m")
      // Name the case only while it's still this office's.
      .joinRaw("LEFT JOIN jobs j ON j.id = m.about_job_id AND j.office_id = m.office_id")
      .where("m.office_id", office.id)
      .orderBy("m.created_at", "asc")
      .select("m.id", "m.sender_role", "m.body", "m.created_at", "j.case_id as about_case_id");

    return Response.json({ data: messages, error: null });
  } catch (err) {
    console.error("[GET /api/track/[token]/dispatch/messages]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load messages" } }, { status: 500 });
  }
}

// POST /api/track/[token]/dispatch/messages
// Body: { body, aboutJobId? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const office = await requireUnlocked(token);
    if (office instanceof Response) return office;

    const readOnly = await refuseIfReadOnly(office.labId);
    if (readOnly) return readOnly;

    const limited = await rateLimited(request, token, "message", 60, 10 * 60);
    if (limited) return limited;

    const { body, aboutJobId } = await request.json().catch(() => ({}));
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!trimmed) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Message body is required" } }, { status: 400 });
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Message is too long" } }, { status: 400 });
    }

    let about: { id: string; caseId: string } | null = null;
    if (aboutJobId != null && aboutJobId !== "") {
      about = typeof aboutJobId === "string" && UUID.test(aboutJobId)
        ? await db("jobs").where({ id: aboutJobId, office_id: office.id }).first("id", "case_id")
        : null;
      if (!about) {
        return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "That case isn't yours" } }, { status: 400 });
      }
    }

    const [message] = await db("direct_messages")
      .insert({
        lab_id: office.labId,
        office_id: office.id,
        sender_role: "office",
        sender_id: null,
        about_job_id: about?.id ?? null,
        body: trimmed,
      })
      .returning(["id", "sender_role", "body", "created_at"]);

    await notifyLab(office.labId, "direct_message", { thread: `office:${office.id}`, officeId: office.id });
    await notifyOfficePage(token, office.accessVersion, "messages");

    return Response.json({ data: { ...message, aboutCaseId: about?.caseId ?? null }, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/track/[token]/dispatch/messages]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to send message" } }, { status: 500 });
  }
}
