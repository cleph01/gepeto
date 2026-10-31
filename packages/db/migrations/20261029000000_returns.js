/**
 * Returning cases: cases a driver picks up at a dental office to bring back to
 * the lab (remakes, adjustments, new work). Each return is its own inbound job
 * with its own number (RET-1001, …) and lifecycle:
 *
 *   with_driver  logged by the driver at the office (usually at a drop-off)
 *   at_lab       driver tapped "Dropped at lab"; waiting for check-in
 *   checked_in   dispatcher closed it out: confirmed the count, gave it a case
 *                number and (optionally) linked the job it came back from
 *
 * Links:
 *   picked_up_during_job_id  the delivery the driver was completing when they
 *                            logged it (set automatically)
 *   source_job_id            "came back from": the original outbound job for
 *                            this case, chosen at check-in
 *   redelivery_job_id        the new delivery job created when the work goes
 *                            back out (later phase)
 *
 * return_events is the insert-only history of each return, shown in its
 * History popup the same way job_status_events/job_edit_events are.
 *
 * Both tables are accessed only through dispatcher-web API routes (service
 * role), so RLS is enabled with no policies. Live updates use broadcasts.
 */
exports.up = async function (knex) {
  // Human-friendly return numbers: RET-1001, RET-1002, …
  await knex.raw("CREATE SEQUENCE IF NOT EXISTS returns_number_seq START 1001");

  await knex.schema.createTable("returns", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.integer("number").notNullable().unique().defaultTo(knex.raw("nextval('returns_number_seq')"));
    table.uuid("lab_id").notNullable().references("id").inTable("labs").onDelete("CASCADE");
    table.uuid("office_id").notNullable().references("id").inTable("offices").onDelete("CASCADE");
    table.uuid("driver_id").nullable().references("id").inTable("drivers").onDelete("SET NULL");
    table.enum("status", ["with_driver", "at_lab", "checked_in"]).notNullable().defaultTo("with_driver");

    // What the driver logged at the office
    table.integer("case_count").notNullable();
    table.jsonb("case_numbers").notNullable().defaultTo("[]"); // optional, as typed by the driver
    table.text("note").nullable();

    // Set at check-in
    table.integer("received_count").nullable(); // what actually arrived, if different
    table.string("case_id").nullable();         // the lab's case number for this return

    table.uuid("picked_up_during_job_id").nullable().references("id").inTable("jobs").onDelete("SET NULL");
    table.uuid("source_job_id").nullable().references("id").inTable("jobs").onDelete("SET NULL");
    table.uuid("redelivery_job_id").nullable().references("id").inTable("jobs").onDelete("SET NULL");

    table.timestamp("picked_up_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("dropped_at").nullable();
    table.timestamp("checked_in_at").nullable();
    table.uuid("checked_in_by_user_id").nullable(); // FK to auth.users (managed by Supabase)
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());

    table.index(["lab_id", "status"]);
    table.index(["lab_id", "picked_up_at"]);
    table.index("driver_id");
    table.index("office_id");
    table.index("source_job_id");
  });

  await knex.raw("ALTER TABLE returns ADD CONSTRAINT returns_case_count_positive CHECK (case_count > 0)");
  await knex.raw("ALTER TABLE returns ADD CONSTRAINT returns_received_count_nonneg CHECK (received_count IS NULL OR received_count >= 0)");
  await knex.raw(`
    CREATE TRIGGER returns_updated_at
    BEFORE UPDATE ON returns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at()
  `);
  await knex.raw("ALTER TABLE returns ENABLE ROW LEVEL SECURITY");
  await knex.raw("ALTER TABLE returns FORCE ROW LEVEL SECURITY");

  await knex.schema.createTable("return_events", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("return_id").notNullable().references("id").inTable("returns").onDelete("CASCADE");
    table.uuid("lab_id").notNullable().references("id").inTable("labs").onDelete("CASCADE");
    // logged | dropped_at_lab | checked_in | linked | redelivery_created | edited
    table.enum("event", ["logged", "dropped_at_lab", "checked_in", "linked", "redelivery_created", "edited"]).notNullable();
    table.jsonb("detail").nullable(); // e.g. { caseCount, receivedCount, caseId, sourceJobId }
    table.enum("actor_role", ["driver", "dispatcher"]).notNullable();
    table.uuid("actor_user_id").notNullable(); // FK to auth.users (managed by Supabase)
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["return_id", "created_at"]);
    table.index("lab_id");
  });

  await knex.raw("ALTER TABLE return_events ENABLE ROW LEVEL SECURITY");
  await knex.raw("ALTER TABLE return_events FORCE ROW LEVEL SECURITY");
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("return_events");
  await knex.schema.dropTableIfExists("returns");
  await knex.raw("DROP SEQUENCE IF EXISTS returns_number_seq");
};
