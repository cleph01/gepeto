import type { NextRequest } from "next/server";
import { deletePodPhotos, podPhotoSettings } from "@/lib/pod-photos";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

/**
 * GET /api/cron/pod-photos
 *
 * Nightly (Vercel Cron). Deletes delivery photos older than each lab's keep
 * time (Settings → Proof of delivery; 90 days unless the lab chose longer),
 * counted from delivery. The job keeps its record and recipient name; only
 * the photo goes, and pod_photo_deleted_at says when.
 * Secured with CRON_SECRET — Vercel sends this automatically.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let deleted = 0;
  const labs = await db("labs").select("id", "settings");
  for (const lab of labs) {
    const { retentionDays } = podPhotoSettings(lab.settings);
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();

    // Batches of 500; a group delivery shares one photo across jobs, hence distinct.
    for (;;) {
      const rows: { podPhotoPath: string }[] = await db("jobs")
        .where({ lab_id: lab.id })
        .whereNotNull("pod_photo_path")
        .where("delivered_at", "<", cutoff)
        .distinct("pod_photo_path")
        .limit(500);
      if (rows.length === 0) break;
      const paths = rows.map((r) => r.podPhotoPath);
      await deletePodPhotos(paths);
      await db("jobs")
        .where({ lab_id: lab.id })
        .whereIn("pod_photo_path", paths)
        .update({ pod_photo_path: null, pod_photo_deleted_at: db.fn.now() });
      deleted += paths.length;
    }
  }

  return Response.json({ deleted });
}
