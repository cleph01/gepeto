// Deletes a lab's data 90 days after its subscription ends, as the Terms promise.
// This can't be undone, so each step is fail-safe: when anything is unclear, the
// lab is left alone and the run reports why. Stays in dry run until
// LAB_DELETION_ENABLED is exactly "true".
import { supabaseAdmin } from "./supabase";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

export const RETENTION_DAYS = 90;
export const WARNING_DAYS = 14;
const MAX_DELETIONS_PER_RUN = 5; // a bug or a bad webhook can't empty the database in one night
const PHOTO_BUCKET = "pod-photos";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;

/** Stripe statuses that mean a subscription is over for good. */
export const ENDED_STATUSES = ["canceled", "incomplete_expired"];

export const deletionDate = (endedAt: string | Date) => new Date(new Date(endedAt).getTime() + RETENTION_DAYS * DAY_MS);

/** What the webhook writes: starts the clock when a subscription ends, stops it if the lab comes back. */
export function subscriptionEndFields(status: string, endedAtSeconds: number | null | undefined, currentEndedAt: string | Date | null) {
  if (!ENDED_STATUSES.includes(status)) return { subscription_ended_at: null, deletion_warned_at: null };
  // A repeat event for the same ending mustn't restart the clock.
  if (currentEndedAt) return {};
  return { subscription_ended_at: endedAtSeconds ? new Date(endedAtSeconds * 1000).toISOString() : new Date().toISOString() };
}

async function deleteLabPhotos(labId: string): Promise<number> {
  // Without this check a blank id would list the whole bucket, every lab's photos.
  if (!UUID.test(labId)) throw new Error("Refusing to delete photos without a valid lab id");
  const bucket = supabaseAdmin.storage.from(PHOTO_BUCKET);
  let total = 0;
  for (;;) {
    const { data, error } = await bucket.list(labId, { limit: 1000 });
    if (error) throw new Error(`Listing photos failed: ${error.message}`);
    if (!data || data.length === 0) return total;
    const { error: removeError } = await bucket.remove(data.map((f) => `${labId}/${f.name}`));
    if (removeError) throw new Error(`Deleting photos failed: ${removeError.message}`);
    total += data.length;
  }
}

/** Removes a sign-in. One that's already gone is fine, so a failed run can be retried. */
export async function deleteAuthUser(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error && error.status !== 404) throw new Error(`Deleting a sign-in failed: ${error.message}`);
}

/**
 * Everything belonging to one lab: photos and sign-ins first, since they live
 * outside the database, then the lab row, which takes all its tables with it.
 * The lab row goes last, so a failure part way can simply run again tomorrow.
 * Stripe's billing records stay, as tax law requires.
 */
export async function deleteLabData(labId: string, removeUser: (userId: string) => Promise<void> = deleteAuthUser) {
  const lab = await db("labs").where({ id: labId }).first();
  if (!lab) throw new Error("Lab not found");

  const photos = await deleteLabPhotos(labId);

  const staff: { userId: string }[] = await db("lab_users").where({ lab_id: labId }).whereNotNull("user_id").select("user_id");
  const drivers: { userId: string }[] = await db("drivers").where({ lab_id: labId }).whereNotNull("user_id").select("user_id");
  const userIds = [...new Set([...staff, ...drivers].map((u) => u.userId))];

  // Someone who also works for another lab keeps their sign-in.
  const [otherStaff, otherDrivers]: { userId: string }[][] = await Promise.all([
    db("lab_users").whereIn("user_id", userIds).whereNot({ lab_id: labId }).select("user_id"),
    db("drivers").whereIn("user_id", userIds).whereNot({ lab_id: labId }).select("user_id"),
  ]);
  const keep = new Set([...otherStaff, ...otherDrivers].map((u) => u.userId));
  const toRemove = userIds.filter((id) => !keep.has(id));
  for (const id of toRemove) await removeUser(id);

  const count = async (table: string) => Number((await db(table).where({ lab_id: labId }).count("* as n").first())?.n ?? 0);
  const counts = { photos, signIns: toRemove.length, jobs: await count("jobs"), returns: await count("returns"), offices: await count("offices"), drivers: await count("drivers") };

  await db.transaction(async (trx: typeof db) => {
    await trx("lab_deletions").insert({
      lab_id: labId,
      stripe_customer_id: lab.stripeCustomerId,
      subscription_ended_at: lab.subscriptionEndedAt,
      counts: JSON.stringify(counts),
    });
    await trx("labs").where({ id: labId }).del();
  });
  return counts;
}

export interface LabDeletionDeps {
  /** Only a true "yes" from Stripe lets a lab be deleted. */
  subscriptionIsOver: (stripeCustomerId: string) => Promise<boolean>;
  sendWarning: (labId: string, deleteOn: Date) => Promise<void>;
  deleteLab?: (labId: string) => Promise<unknown>;
  now?: Date;
}

/** One nightly pass: warn labs 14 days ahead, then delete those that are due. */
export async function runLabDeletion(enabled: boolean, deps: LabDeletionDeps) {
  const now = deps.now ?? new Date();
  const deleteLab = deps.deleteLab ?? deleteLabData;
  const result = {
    dryRun: !enabled,
    warned: [] as string[],
    deleted: [] as string[],
    wouldWarn: [] as string[],
    wouldDelete: [] as string[],
    skipped: [] as { labId: string; reason: string }[],
  };

  const warnFrom = new Date(now.getTime() - (RETENTION_DAYS - WARNING_DAYS) * DAY_MS).toISOString();
  const labs: { id: string; stripeCustomerId: string | null; subscriptionStatus: string | null; subscriptionEndedAt: string; deletionWarnedAt: string | null }[] =
    await db("labs")
      .whereNotNull("subscription_ended_at")
      .where("subscription_ended_at", "<=", warnFrom)
      .orderBy("subscription_ended_at", "asc")
      .select("id", "stripe_customer_id", "subscription_status", "subscription_ended_at", "deletion_warned_at");

  for (const lab of labs) {
    const skip = (reason: string) => result.skipped.push({ labId: lab.id, reason });
    if (!lab.subscriptionStatus || !ENDED_STATUSES.includes(lab.subscriptionStatus)) { skip("Subscription isn't marked as ended"); continue; }
    if (!lab.stripeCustomerId) { skip("No Stripe customer to confirm with"); continue; }

    try {
      if (!(await deps.subscriptionIsOver(lab.stripeCustomerId))) { skip("Stripe shows a live subscription"); continue; }

      const scheduled = deletionDate(lab.subscriptionEndedAt);
      if (!lab.deletionWarnedAt) {
        // Owners always get the full warning period, even if an earlier warning failed.
        const warningEnd = new Date(now.getTime() + WARNING_DAYS * DAY_MS);
        const deleteOn = scheduled > warningEnd ? scheduled : warningEnd;
        if (!enabled) { result.wouldWarn.push(lab.id); continue; }
        await deps.sendWarning(lab.id, deleteOn);
        await db("labs").where({ id: lab.id }).update({ deletion_warned_at: now.toISOString() });
        result.warned.push(lab.id);
        continue;
      }

      const warnedLongEnough = new Date(lab.deletionWarnedAt).getTime() + WARNING_DAYS * DAY_MS <= now.getTime();
      if (scheduled > now || !warnedLongEnough) continue;

      if (!enabled) { result.wouldDelete.push(lab.id); continue; }
      if (result.deleted.length >= MAX_DELETIONS_PER_RUN) { skip("Reached this run's limit; the next run continues"); continue; }
      await deleteLab(lab.id);
      result.deleted.push(lab.id);
    } catch (err) {
      console.error("[lab-deletion]", lab.id, err);
      skip(err instanceof Error ? err.message : "Unknown error");
    }
  }
  return result;
}
