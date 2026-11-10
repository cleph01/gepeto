import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkAbout, checkBody, driversOnly, sendDirectMessage, threadMessages } from "@/lib/direct-messages";

// The signed-in driver's private thread with dispatch. The driver is always
// taken from the session, never from the request, so a driver can only ever
// reach their own thread. Offices never see it.

// GET /api/driver/dispatch
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "driver" || !user.driverId) return driversOnly();
    return Response.json({ data: await threadMessages({ kind: "driver", id: user.driverId }), error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/driver/dispatch]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch messages" } }, { status: 500 });
  }
}

// POST /api/driver/dispatch  { body, aboutJobId? }  aboutJobId must be one of this driver's cases.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "driver" || !user.driverId) return driversOnly();
    const party = { kind: "driver" as const, id: user.driverId };
    const { body, aboutJobId } = await request.json().catch(() => ({}));
    const text = checkBody(body);
    if (text instanceof Response) return text;
    const about = await checkAbout(user.labId, party, aboutJobId);
    if (about instanceof Response) return about;
    const data = await sendDirectMessage({ labId: user.labId, party, senderRole: "driver", senderId: user.id, body: text, about });
    return Response.json({ data, error: null }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/driver/dispatch]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to send message" } }, { status: 500 });
  }
}
