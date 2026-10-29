/**
 * Audit trail of dispatcher edits to a job's details: one row per field
 * changed, with the before/after values as display text. Shown alongside
 * job_status_events in the job's History popup.
 *
 * field: case_id | office | scheduled_at | driver | priority
 *   old_value/new_value hold what the History popup shows: the case number,
 *   office name, ISO time, driver name, or priority (null = none/unassigned).
 *
 * Also used to scope an office's message thread: after an office change, the
 * new office only sees messages from after its latest "office" edit.
 *
 * Insert-only. Accessed only through dispatcher-web / office-portal API routes
 * (service role), so RLS is enabled with no policies.
 */
exports.up = async function (knex) {
  await knex.schema.createTable("job_edit_events", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("job_id").notNullable().references("id").inTable("jobs").onDelete("CASCADE");
    table.uuid("lab_id").notNullable().references("id").inTable("labs").onDelete("CASCADE");
    table.enum("field", ["case_id", "office", "scheduled_at", "driver", "priority"]).notNullable();
    table.text("old_value").nullable();
    table.text("new_value").nullable();
    table.uuid("changed_by_user_id").notNullable(); // FK to auth.users (managed by Supabase)
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["job_id", "created_at"]);
    table.index("lab_id");
  });

  await knex.raw("ALTER TABLE job_edit_events ENABLE ROW LEVEL SECURITY");
  await knex.raw("ALTER TABLE job_edit_events FORCE ROW LEVEL SECURITY");
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("job_edit_events");
};
