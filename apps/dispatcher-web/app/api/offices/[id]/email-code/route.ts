import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDispatcherEmails, sendOfficeAccessCode } from "@/lib/email";
import { ensureAccessCode, OFFICE_COLUMNS, officeAccess, officeForLab } from "@/lib/office-access";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/offices/[id]/email-code — dispatcher only
// Sends the office its code at the email on file. Replies go to the lab.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can email access codes" } }, { status: 403 });
    }

    const { id } = await params;
    const row = await db("offices").where({ id, lab_id: user.labId }).first(OFFICE_COLUMNS);
    if (!row) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Office not found" } }, { status: 404 });
    }
    if (!row.email) {
      return Response.json({ data: null, error: { code: "NO_EMAIL", message: "Add an email address for this office first." } }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
      return Response.json({ data: null, error: { code: "EMAIL_NOT_SET_UP", message: "Email isn't set up yet. Copy the code and send it yourself for now." } }, { status: 503 });
    }
    if (!(await officeAccess.withinRateLimit(`email-code:${id}`, 5, 60 * 60))) {
      return Response.json({ data: null, error: { code: "TOO_MANY", message: "This code has been emailed several times this hour. Try again later." } }, { status: 429 });
    }

    const office = officeForLab(await ensureAccessCode(row));
    const lab = await db("labs").where({ id: user.labId }).first("name");
    const { error } = await sendOfficeAccessCode(office.email!, {
      officeName: office.name,
      labName: lab.name,
      code: office.accessCode!,
      replyTo: await getDispatcherEmails(user.labId),
    });
    if (error) {
      console.error("[POST /api/offices/[id]/email-code] resend", error);
      return Response.json({ data: null, error: { code: "EMAIL_FAILED", message: "The email didn't send. Copy the code and send it yourself, or try again." } }, { status: 502 });
    }

    return Response.json({ data: { sentTo: office.email }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/offices/[id]/email-code]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to send the email" } }, { status: 500 });
  }
}
