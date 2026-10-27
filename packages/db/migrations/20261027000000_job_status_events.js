/**
 * Audit trail of job status changes: one row per change, recording who made
 * it (dispatcher or driver), when, and the before/after status. Job creation
 * is logged too, with from_status null.
 *
 * Rows are only ever inserted, never updated, so the history stays auditable.
 *
 * Only accessed through dispatcher-web API routes (service role), so RLS is
 * enabled with no policies — direct client access is denied.
 */
exports.up = async function (knex) {
  await knex.schema.createTable("job_status_events", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("job_id").notNullable().references("id").inTable("jobs").onDelete("CASCADE");
    table.uuid("lab_id").notNullable().references("id").inTable("labs").onDelete("CASCADE");
    table.string("from_status").nullable();
    table.string("to_status").notNullable();
    table.enum("changed_by_role", ["dispatcher", "driver"]).notNullable();
    table.uuid("changed_by_user_id").notNullable(); // FK to auth.users (managed by Supabase)
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["job_id", "created_at"]);
    table.index("lab_id");
  });

  await knex.raw("ALTER TABLE job_status_events ENABLE ROW LEVEL SECURITY");
  await knex.raw("ALTER TABLE job_status_events FORCE ROW LEVEL SECURITY");
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("job_status_events");
};
