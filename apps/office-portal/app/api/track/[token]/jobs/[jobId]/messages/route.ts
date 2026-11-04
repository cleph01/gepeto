import type { NextRequest } from "next/server";
import { rateLimited, requireUnlocked } from "@/lib/access";
import { notifyLab, notifyOfficePage } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const MAX_BODY_LENGTH = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The job if it's this office's and the code was entered; otherwise the Response to send. */
async function resolveJobForToken(token: string, jobId: string) {
  const office = await requireUnlocked(token);
  if (office instanceof Response) return office;

  const job = UUID.test(jobId)
    ? await db("jobs").where({ id: jobId, office_id: office.id }).select("id", "lab_id").first()
    : null;
  if (job) return { ...job, accessVersion: office.accessVersion };
  return Response.json(
    { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
    { status: 404 }
  );
}

// GET /api/track/[token]/jobs/[jobId]/messages
// Behind the access code, scoped to one job of this office's.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; jobId: string }> }
) {
  try {
    const { token, jobId } = await params;

    const job = await resolveJobForToken(token, jobId);
    if (job instanceof Response) return job;

    // If the job was moved to this office from another one, only show
    // messages from after the move, so one office never reads another's.
    const lastMove = await db("job_edit_events")
      .where({ job_id: jobId, field: "office" })
      .max("created_at as at")
      .first();

    const query = db("messages")
      .where("job_id", jobId)
      .orderBy("created_at", "asc")
      .select("id", "sender_role", "body", "created_at");
    if (lastMove?.at) query.where("created_at", ">=", lastMove.at);
    const messages = await query;

    return Response.json({ data: messages, error: null });
  } catch (err) {
    console.error("[GET /api/track/[token]/jobs/[jobId]/messages]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load messages" } },
      { status: 500 }
    );
  }
}

// POST /api/track/[token]/jobs/[jobId]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; jobId: string }> }
) {
  try {
    const { token, jobId } = await params;

    const job = await resolveJobForToken(token, jobId);
    if (job instanceof Response) return job;

    const limited = await rateLimited(request, token, "message", 60, 10 * 60);
    if (limited) return limited;

    const { body } = await request.json();
    const trimmed = typeof body === "string" ? body.trim() : "";
    if (!trimmed) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "Message body is required" } },
        { status: 400 }
      );
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "Message is too long" } },
        { status: 400 }
      );
    }

    const [message] = await db("messages")
      .insert({
        job_id: jobId,
        sender_role: "office",
        sender_id: null,
        body: trimmed,
      })
      .returning(["id", "sender_role", "body", "created_at"]);

    await notifyLab(job.labId, "message", { jobId });
    await notifyOfficePage(token, job.accessVersion, "messages");

    return Response.json({ data: message, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/track/[token]/jobs/[jobId]/messages]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to send message" } },
      { status: 500 }
    );
  }
}
