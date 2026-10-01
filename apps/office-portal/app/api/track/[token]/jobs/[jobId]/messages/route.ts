import type { NextRequest } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const MAX_BODY_LENGTH = 2000;

async function resolveJobForToken(token: string, jobId: string) {
  const office = await db("offices").where("tracking_token", token).select("id").first();
  if (!office) return null;

  const job = await db("jobs")
    .where({ id: jobId, office_id: office.id })
    .select("id")
    .first();
  return job ?? null;
}

// GET /api/track/[token]/jobs/[jobId]/messages
// Public endpoint — the tracking token is the auth secret, scoped to one job.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; jobId: string }> }
) {
  try {
    const { token, jobId } = await params;

    const job = await resolveJobForToken(token, jobId);
    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    const messages = await db("messages")
      .where("job_id", jobId)
      .orderBy("created_at", "asc")
      .select("id", "sender_role", "body", "created_at");

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
    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

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
        office_token: token,
        body: trimmed,
      })
      .returning(["id", "sender_role", "body", "created_at"]);

    return Response.json({ data: message, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/track/[token]/jobs/[jobId]/messages]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to send message" } },
      { status: 500 }
    );
  }
}
