/**
 * Per-user read tracking for job message threads, so dispatcher-web can show
 * unread badges. One row per (user, job) holding the last time that user
 * opened the thread — anything from an office/driver newer than that is unread.
 *
 * Not using messages.read_at: a thread has several readers (each dispatcher,
 * the office, the driver), and a single column would clear it for everyone.
 *
 * Only accessed through dispatcher-web API routes (service role), so RLS is
 * enabled with no policies — direct client access is denied.
 */
exports.up = async function (knex) {
  await knex.schema.createTable("message_reads", (table) => {
    table.uuid("user_id").notNullable();
    table.uuid("job_id").notNullable().references("id").inTable("jobs").onDelete("CASCADE");
    table.timestamp("last_read_at").notNullable().defaultTo(knex.fn.now());
    table.primary(["user_id", "job_id"]);
  });

  await knex.raw("ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY");
  await knex.raw("ALTER TABLE message_reads FORCE ROW LEVEL SECURITY");

  // Unread lookups filter incoming messages by job + time
  await knex.raw(
    "CREATE INDEX IF NOT EXISTS messages_job_id_created_at_idx ON messages (job_id, created_at)"
  );
};

exports.down = async function (knex) {
  await knex.raw("DROP INDEX IF EXISTS messages_job_id_created_at_idx");
  await knex.schema.dropTableIfExists("message_reads");
};
