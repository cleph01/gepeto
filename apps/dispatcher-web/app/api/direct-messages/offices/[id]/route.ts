import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyLab, notifyOffices } from "@/lib/realtime";
import { MAX_DIRECT_MESSAGE_LENGTH, isUuid, officeForDispatcher, officeNotFound, threadMessages } from "@/lib/direct-messages";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/direct-messages/offices/[id]
// Dispatcher only. The lab's private thread with this office. With
// ?aboutJobId=, only the messages about that case (the job's Messages window).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const office = await officeForDispatcher(user, id);
    if (!office) return officeNotFound();

    const query = threadMessages(office.id);
    const aboutJobId = request.nextUrl.searchParams.get("aboutJobId");
    if (aboutJobId) {
      if (!isUuid(aboutJobId)) return Response.json({ data: [], error: null });
      query.where("m.about_job_id", aboutJobId);
    }
    return Response.json({ data: await query, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/direct-messages/offices/[id]]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch messages" } }, { status: 500 });
  }
}

// POST /api/direct-messages/offices/[id]
// Body: { body, aboutJobId? }. Only this office and the lab see it.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const office = await officeForDispatcher(user, id);
    if (!office) return officeNotFound();

    const { body, aboutJobId } = await request.json().catch(() => ({}));
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!trimmed) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Message body is required" } }, { status: 400 });
    }
    if (trimmed.length > MAX_DIRECT_MESSAGE_LENGTH) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Message is too long" } }, { status: 400 });
    }

    // The case has to be this office's, in this lab.
    let about: { id: string; caseId: string } | null = null;
    if (aboutJobId != null && aboutJobId !== "") {
      about = isUuid(aboutJobId)
        ? await db("jobs").where({ id: aboutJobId, lab_id: user.labId, office_id: office.id }).first("id", "case_id")
        : null;
      if (!about) {
        return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "That case isn't this office's" } }, { status: 400 });
      }
    }

    const [message] = await db("direct_messages")
      .insert({
        lab_id: user.labId,
        office_id: office.id,
        sender_role: "dispatcher",
        sender_id: user.id,
        about_job_id: about?.id ?? null,
        body: trimmed,
      })
      .returning(["id", "sender_role", "body", "created_at", "about_job_id"]);

    await notifyLab(user.labId, "direct_message", { officeId: office.id });
    await notifyOffices([office.id], "messages");

    return Response.json({ data: { ...message, aboutCaseId: about?.caseId ?? null }, error: null }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/direct-messages/offices/[id]]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to send message" } }, { status: 500 });
  }
}
