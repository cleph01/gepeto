import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { RETENTION_CHOICES, podPhotoSettings } from "@/lib/pod-photos";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

function forbidden() {
  return Response.json(
    { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can change delivery photo settings" } },
    { status: 403 }
  );
}

// GET /api/settings/delivery-photos — { required, retentionDays }
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") return forbidden();
    const lab = await db("labs").where({ id: user.labId }).first("settings");
    return Response.json({ data: podPhotoSettings(lab?.settings), error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/settings/delivery-photos]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load settings" } },
      { status: 500 }
    );
  }
}

// PATCH /api/settings/delivery-photos — body { required?, retentionDays? }
// A shorter keep time takes effect at the next nightly cleanup; a longer one
// also covers photos not yet removed.
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") return forbidden();
    const body = await request.json();

    if (body.required !== undefined && typeof body.required !== "boolean") {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "required must be true or false" } },
        { status: 400 }
      );
    }
    if (body.retentionDays !== undefined && !(RETENTION_CHOICES as readonly number[]).includes(body.retentionDays)) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: `retentionDays must be one of ${RETENTION_CHOICES.join(", ")}` } },
        { status: 400 }
      );
    }

    const settings = await db.transaction(async (trx: typeof db) => {
      const lab = await trx("labs").where({ id: user.labId }).forUpdate().first("settings");
      const next = { ...(lab?.settings ?? {}) };
      if (body.required !== undefined) next.podPhotoRequired = body.required;
      if (body.retentionDays !== undefined) next.podPhotoRetentionDays = body.retentionDays;
      await trx("labs").where({ id: user.labId }).update({ settings: next });
      return next;
    });

    return Response.json({ data: podPhotoSettings(settings), error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/settings/delivery-photos]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to save settings" } },
      { status: 500 }
    );
  }
}
