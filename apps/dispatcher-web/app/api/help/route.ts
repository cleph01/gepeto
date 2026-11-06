import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { dispatcherManual } from "@/lib/help/content";
import { driverGuide } from "@/lib/help/driver-content";

// GET /api/help — the signed-in user's guide: the Dispatcher manual, or the
// driver guide for the driver app. Served here rather than in a page or bundle
// so its text is never sent to someone who isn't signed in.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    return Response.json({
      data: user.role === "driver" ? driverGuide : dispatcherManual,
      error: null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/help]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load help" } },
      { status: 500 }
    );
  }
}
