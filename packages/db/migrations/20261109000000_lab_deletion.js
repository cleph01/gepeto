/**
 * Deleting a lab's data 90 days after its subscription ends (see the Terms).
 *
 *   labs.subscription_ended_at  set by the Stripe webhook when a subscription
 *                               ends, and cleared if the lab subscribes again.
 *                               NULL means the lab is never considered, which
 *                               covers comped labs and labs with no plan.
 *   labs.deletion_warned_at     when the owners were told it's coming. A lab is
 *                               never deleted without this.
 *   lab_deletions               what's left afterward, as proof it happened.
 *                               No names, emails or delivery data. Deliberately
 *                               no foreign key: the lab is gone.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("labs", (table) => {
    table.timestamp("subscription_ended_at").nullable();
    table.timestamp("deletion_warned_at").nullable();
    table.index("subscription_ended_at");
  });

  await knex.schema.createTable("lab_deletions", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.uuid("lab_id").notNullable();
    table.string("stripe_customer_id").nullable(); // Stripe keeps the billing records
    table.timestamp("subscription_ended_at").nullable();
    table.timestamp("deleted_at").notNullable().defaultTo(knex.fn.now());
    table.jsonb("counts").notNullable().defaultTo("{}");
  });
  await knex.raw("ALTER TABLE lab_deletions ENABLE ROW LEVEL SECURITY");
  await knex.raw("ALTER TABLE lab_deletions FORCE ROW LEVEL SECURITY");
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("lab_deletions");
  await knex.schema.alterTable("labs", (table) => {
    table.dropIndex("subscription_ended_at");
    table.dropColumn("subscription_ended_at");
    table.dropColumn("deletion_warned_at");
  });
};
