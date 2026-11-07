/**
 * Messages on a return: one conversation per return between the lab, the
 * office and whichever driver has it.
 *
 * Separate from `messages`, whose rows, read tracking and driver access rules
 * all hang off a job. Like the other returns tables, these are reached only
 * through API routes (service role), so RLS is on with no policies, and live
 * updates use broadcasts.
 *
 * return_message_reads works like message_reads: one row per (user, return)
 * holding what that person has seen. Offices don't log in, so theirs stays in
 * the browser, as it does for job messages.
 */
exports.up = async function (knex) {
  await knex.schema.createTable("return_messages", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("return_id").notNullable().references("id").inTable("returns").onDelete("CASCADE");
    table.uuid("lab_id").notNullable().references("id").inTable("labs").onDelete("CASCADE");
    table.enum("sender_role", ["dispatcher", "driver", "office"]).notNullable();
    table.uuid("sender_id").nullable(); // FK to auth.users; offices have no account
    table.text("body").notNullable();
    table.timestamp("created_at").notNullable().defaultTo(knex.fn.now());
    table.index(["return_id", "created_at"]);
    table.index("lab_id");
  });

  await knex.schema.createTable("return_message_reads", (table) => {
    table.uuid("user_id").notNullable();
    table.uuid("return_id").notNullable().references("id").inTable("returns").onDelete("CASCADE");
    table.timestamp("last_read_at").notNullable().defaultTo(knex.fn.now());
    table.primary(["user_id", "return_id"]);
  });

  for (const name of ["return_messages", "return_message_reads"]) {
    await knex.raw(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`);
    await knex.raw(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`);
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("return_message_reads");
  await knex.schema.dropTableIfExists("return_messages");
};
