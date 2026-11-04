import type { NextRequest } from "next/server";
import { loadTrackingForRequest } from "@/lib/tracking";

// GET /api/track/[token]
// The link alone gets basic case status; with the access code session, the full
// view. See lib/tracking.ts for what each one sends.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const data = await loadTrackingForRequest(token);
    if (!data) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Tracking link not found" } },
        { status: 404 }
      );
    }
    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[GET /api/track/[token]]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load tracking data" } },
      { status: 500 }
    );
  }
}
