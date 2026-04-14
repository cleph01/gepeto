import type { NextRequest } from "next/server";
import {
  sendUnassignedJobAlert,
  sendLateDeliveryAlert,
  getDispatcherEmails,
  getDashboardUrl,
} from "@/lib/email";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

/**
 * GET /api/cron/alerts
 *
 * Called by Vercel Cron every 5 minutes. Checks two conditions across all labs:
 *   1. Jobs that have been pending (unassigned) longer than the lab's threshold.
 *   2. Jobs in transit past their scheduled delivery time.
 *
 * Each alert is sent at most once per job (tracked by alerted_at timestamps).
 * Secured with CRON_SECRET — Vercel sends this automatically.
 */
export async function GET(request: NextRequest) {
  // Verify caller is Vercel Cron (or local dev with the secret)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return Response.json({ skipped: "RESEND_API_KEY not set" });
  }

  const now = new Date();
  let unassignedSent = 0;
  let lateSent = 0;

  // Load all labs that have notifications enabled
  const labs = await db("labs").select("id", "name", "settings");

  for (const lab of labs) {
    const settings = lab.settings ?? {};
    const notifs = settings.notifications ?? {};
    const dashboardUrl = getDashboardUrl();

    // ── 1. Unassigned job alert ─────────────────────────────────────────────
    if (notifs.unassignedAlert !== false) {
      const thresholdMins = parseInt(notifs.unassignedMinutes ?? "15", 10);
      const cutoff = new Date(now.getTime() - thresholdMins * 60_000);

      const jobs = await db("jobs")
        .leftJoin("offices", "jobs.office_id", "offices.id")
        .where("jobs.lab_id", lab.id)
        .where("jobs.status", "pending")
        .whereNull("jobs.driver_id")
        .whereNull("jobs.unassigned_alerted_at")
        .where("jobs.created_at", "<", cutoff)
        .select("jobs.id", "jobs.case_id", "offices.name as office_name");

      if (jobs.length > 0) {
        const to = await getDispatcherEmails(lab.id);
        if (to.length > 0) {
          for (const job of jobs) {
            const jobRow = await db("jobs")
              .where({ id: job.id })
              .select("created_at")
              .first();
            const mins = Math.floor(
              (now.getTime() - new Date(jobRow.createdAt).getTime()) / 60_000
            );

            await sendUnassignedJobAlert(to, {
              caseId:            job.caseId,
              officeName:        job.officeName ?? "Unknown Office",
              minutesUnassigned: mins,
              labName:           lab.name,
              dashboardUrl:      `${dashboardUrl}/jobs`,
            }).catch((e: unknown) => console.error("[cron] unassigned alert failed:", e));

            await db("jobs")
              .where({ id: job.id })
              .update({ unassigned_alerted_at: now });

            unassignedSent++;
          }
        }
      }
    }

    // ── 2. Late delivery alert ──────────────────────────────────────────────
    if (notifs.lateDeliveryAlert !== false) {
      const thresholdMins = parseInt(notifs.lateDeliveryMins ?? "30", 10);
      const cutoff = new Date(now.getTime() - thresholdMins * 60_000);

      const jobs = await db("jobs")
        .leftJoin("offices", "jobs.office_id", "offices.id")
        .leftJoin("drivers", "jobs.driver_id", "drivers.id")
        .where("jobs.lab_id", lab.id)
        .whereIn("jobs.status", ["assigned", "picked_up", "in_transit", "arrived"])
        .whereNotNull("jobs.scheduled_at")
        .whereNull("jobs.late_alerted_at")
        .where("jobs.scheduled_at", "<", cutoff)
        .select(
          "jobs.id",
          "jobs.case_id",
          "jobs.scheduled_at",
          "offices.name as office_name",
          "drivers.name as driver_name"
        );

      if (jobs.length > 0) {
        const to = await getDispatcherEmails(lab.id);
        if (to.length > 0) {
          for (const job of jobs) {
            const mins = Math.floor(
              (now.getTime() - new Date(job.scheduledAt).getTime()) / 60_000
            );

            await sendLateDeliveryAlert(to, {
              caseId:         job.caseId,
              officeName:     job.officeName ?? "Unknown Office",
              driverName:     job.driverName ?? "Unassigned",
              minutesOverdue: mins,
              labName:        lab.name,
              dashboardUrl:   `${dashboardUrl}/jobs`,
            }).catch((e: unknown) => console.error("[cron] late delivery alert failed:", e));

            await db("jobs")
              .where({ id: job.id })
              .update({ late_alerted_at: now });

            lateSent++;
          }
        }
      }
    }
  }

  return Response.json({ ok: true, unassignedSent, lateSent });
}
