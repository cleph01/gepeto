import type { NextRequest } from "next/server";
import { loadTracking } from "@/lib/tracking";

// GET /api/track/[token]
// Public endpoint — token acts as the auth secret.
// Returns the office, its active jobs (grouped client-side by driver) and the
// last few deliveries. See lib/tracking.ts for what's withheld.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const data = await loadTracking(token);
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
