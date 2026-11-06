import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { dispatcherManual } from "@/lib/help/content";

// GET /api/help — the Dispatcher manual. Served here rather than in a page or
// client bundle so its text is never sent to someone who isn't signed in.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can view this manual" } },
        { status: 403 }
      );
    }
    return Response.json({ data: dispatcherManual, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/help]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load help" } },
      { status: 500 }
    );
  }
}
