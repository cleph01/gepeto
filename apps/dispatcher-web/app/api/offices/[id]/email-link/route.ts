import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDispatcherEmails, sendOfficeTrackingLink } from "@/lib/email";
import { officeAccess } from "@/lib/office-access";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// Production has to name its portal: a guessed address would email a dead link.
function trackingBase(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_TRACKING_BASE_URL) return process.env.NEXT_PUBLIC_TRACKING_BASE_URL;
  if (process.env.NODE_ENV === "production") return null;
  return `http://${request.nextUrl.hostname}:3001/t`;
}

// POST /api/offices/[id]/email-link — dispatcher only
// Sends the office its tracking link at the email on file. Replies go to the lab.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can email tracking links" } }, { status: 403 });
    }

    const { id } = await params;
    const office = await db("offices").where({ id, lab_id: user.labId }).first("name", "email", "tracking_token");
    if (!office) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Office not found" } }, { status: 404 });
    }
    if (!office.email) {
      return Response.json({ data: null, error: { code: "NO_EMAIL", message: "Add an email address for this office first." } }, { status: 400 });
    }
    const base = trackingBase(request);
    if (!process.env.RESEND_API_KEY || !base) {
      return Response.json({ data: null, error: { code: "EMAIL_NOT_SET_UP", message: "Email isn't set up yet. Copy the link and send it yourself for now." } }, { status: 503 });
    }
    if (!(await officeAccess.withinRateLimit(`email-link:${id}`, 5, 60 * 60))) {
      return Response.json({ data: null, error: { code: "TOO_MANY", message: "This link has been emailed several times this hour. Try again later." } }, { status: 429 });
    }

    const lab = await db("labs").where({ id: user.labId }).first("name");
    const { error } = await sendOfficeTrackingLink(office.email, {
      officeName: office.name,
      labName: lab.name,
      url: `${base}/${office.trackingToken}`,
      replyTo: await getDispatcherEmails(user.labId),
    });
    if (error) {
      console.error("[POST /api/offices/[id]/email-link] resend", error);
      return Response.json({ data: null, error: { code: "EMAIL_FAILED", message: "The email didn't send. Copy the link and send it yourself, or try again." } }, { status: 502 });
    }

    return Response.json({ data: { sentTo: office.email }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/offices/[id]/email-link]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to send the email" } }, { status: 500 });
  }
}
