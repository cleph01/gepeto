import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { podPhotoSettings } from "@/lib/pod-photos";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/driver/settings — the lab choices the driver app needs.
// Returns { podPhotoRequired }.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const lab = await db("labs").where({ id: user.labId }).first("settings");
    return Response.json({ data: { podPhotoRequired: podPhotoSettings(lab?.settings).required }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/driver/settings]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load settings" } },
      { status: 500 }
    );
  }
}
