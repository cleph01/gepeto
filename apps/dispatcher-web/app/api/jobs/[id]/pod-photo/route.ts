import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { signPodPhoto } from "@/lib/pod-photos";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/jobs/[id]/pod-photo
// A 5-minute signed link to the job's delivery photo, for the lab's
// dispatchers and the job's own driver. Returns { url } or, once the nightly
// cleanup has removed it, { url: null, deletedAt }.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const job = await db("jobs")
      .where(user.role === "driver"
        ? { id, lab_id: user.labId, driver_id: user.driverId }
        : { id, lab_id: user.labId })
      .first("pod_photo_path", "pod_photo_deleted_at");

    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }
    const url = job.podPhotoPath ? await signPodPhoto(job.podPhotoPath) : null;
    return Response.json({ data: { url, deletedAt: job.podPhotoDeletedAt }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/jobs/[id]/pod-photo]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load the photo" } },
      { status: 500 }
    );
  }
}
