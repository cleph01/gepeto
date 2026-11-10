/**
 * Private conversations between the lab's dispatch and one office or one driver.
 *
 * The case conversations in `messages` and `return_messages` are shared by
 * everyone on the case. These aren't: an office never sees dispatch's private
 * thread with a driver, and a driver never sees dispatch's with an office.
 * There is no private office-driver thread; those two talk on the case, where
 * dispatch can see it.
 *
 * One thread per person, not per case, because "running 20 late" isn't about
 * any one case. A message can still name the case it's about (about_job_id).
 * Exactly one of office_id and driver_id is set: that's who the thread is with.
 *
 * Like the returns tables, these are reached only through API routes (service
 * role), so RLS is on with no policies, and live updates use broadcasts. That
 * also means nothing private can reach a phone or browser through realtime.
 *
 * direct_message_reads works like message_reads, keyed by thread
 * ("office:<id>" or "driver:<id>"). Offices don't log in, so theirs stays in
 * the browser.
 */
exports.up = async function (knex) {
  await knex.schema.createTable("direct_messages", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("lab_id").notNullable().references("id").inTable("labs").onDelete("CASCADE");
    table.uuid("office_id").nullable().references("id").inTable("offices").onDelete("CASCADE");
    table.uuid("driver_id").nullable().references("id").inTable("drivers").onDelete("CASCADE");
    table.enum("sender_role", ["dispatcher", "driver", "office"]).notNullable();
    table.uuid("sender_id").nullable(); // FK to auth.users; offices have no account
    table.uuid("about_job_id").nullable().references("id").inTable("jobs").onDelete("SET NULL");
    table.text("body").notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["lab_id", "office_id", "created_at"]);
    table.index(["lab_id", "driver_id", "created_at"]);
    table.index("about_job_id");
  });
  await knex.raw(`
    ALTER TABLE direct_messages ADD CONSTRAINT direct_messages_one_party
      CHECK ((office_id IS NULL) <> (driver_id IS NULL))
  `);

  await knex.schema.createTable("direct_message_reads", (table) => {
    table.uuid("user_id").notNullable();
    table.text("thread").notNullable();
    table.timestamp("last_read_at").notNullable().defaultTo(knex.fn.now());
    table.primary(["user_id", "thread"]);
  });

  for (const name of ["direct_messages", "direct_message_reads"]) {
    await knex.raw(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`);
    await knex.raw(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`);
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("direct_message_reads");
  await knex.schema.dropTableIfExists("direct_messages");
};
