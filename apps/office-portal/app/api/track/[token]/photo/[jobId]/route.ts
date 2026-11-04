import type { NextRequest } from "next/server";
import { requireUnlocked } from "@/lib/access";
import { signPodPhoto } from "@/lib/pod-photos";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/track/[token]/photo/[jobId]
// Behind the access code. Redirects to a 5-minute signed link to the
// drop-off photo of one of this office's delivered cases, so it works as an
// <img src> or a plain link.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; jobId: string }> }
) {
  try {
    const { token, jobId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return new Response("Not found", { status: 404 });

    const office = await requireUnlocked(token);
    if (office instanceof Response) return office;

    const job = await db("jobs")
      .where("jobs.office_id", office.id)
      .where("jobs.id", jobId)
      .where("jobs.status", "delivered")
      .first("jobs.pod_photo_path");
    const url = job?.podPhotoPath ? await signPodPhoto(job.podPhotoPath) : null;
    if (!url) return new Response("Photo not found", { status: 404 });

    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("[GET /api/track/[token]/photo/[jobId]]", err);
    return new Response("Failed to load the photo", { status: 500 });
  }
}
