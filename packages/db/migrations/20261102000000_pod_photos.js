/**
 * Proof-of-delivery photos (agreed 2026-11-01).
 *
 *   jobs.pod_photo_path        object path in the private "pod-photos" storage
 *                              bucket: <lab_id>/<uuid>.jpg. A group delivery
 *                              ("Complete all") shares one photo across jobs.
 *   jobs.pod_photo_deleted_at  set when the nightly cleanup removed the photo
 *                              (path is cleared), so screens can say why it's gone.
 *
 * Lab choices live in labs.settings: podPhotoRequired (default false) and
 * podPhotoRetentionDays (90 default; 180, 365 or 730). Photos are deleted
 * that many days after delivery. Photos should show the drop-off, never the
 * paperwork, so patient names don't end up in storage.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("jobs", (table) => {
    table.string("pod_photo_path").nullable();
    table.timestamp("pod_photo_deleted_at").nullable();
  });

  // Private bucket: photos are only ever served through short-lived signed URLs.
  await knex.raw(`
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('pod-photos', 'pod-photos', false, 5242880, ARRAY['image/jpeg'])
    ON CONFLICT (id) DO NOTHING
  `);
};

exports.down = async function (knex) {
  await knex.schema.alterTable("jobs", (table) => {
    table.dropColumn("pod_photo_path");
    table.dropColumn("pod_photo_deleted_at");
  });
  // The bucket (and any photos in it) is left in place; remove it from the
  // Supabase dashboard if it's really no longer wanted.
};
