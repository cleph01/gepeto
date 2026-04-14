import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/jobs/[id]/messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Verify job belongs to this lab
    const job = await db("jobs").where({ id, lab_id: user.labId }).first();
    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    const messages = await db("messages")
      .where("job_id", id)
      .orderBy("created_at", "asc")
      .select("*");

    return Response.json({ data: messages, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/jobs/[id]/messages]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch messages" } },
      { status: 500 }
    );
  }
}

// POST /api/jobs/[id]/messages
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Verify job belongs to this lab
    const job = await db("jobs").where({ id, lab_id: user.labId }).first();
    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    const { body } = await request.json();
    if (!body?.trim()) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "Message body is required" } },
        { status: 400 }
      );
    }

    const [message] = await db("messages")
      .insert({
        job_id: id,
        sender_role: user.role,
        sender_id: user.id,
        body: body.trim(),
      })
      .returning("*");

    return Response.json({ data: message, error: null }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/jobs/[id]/messages]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to send message" } },
      { status: 500 }
    );
  }
}
