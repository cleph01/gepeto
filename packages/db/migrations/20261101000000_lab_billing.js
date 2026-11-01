/**
 * Plans and billing per lab (pricing agreed 2026-11-01).
 *
 *   plan                starter | growth | pro; NULL = no plan (labs created
 *                       before billing existed, or comped): no driver limit
 *   billing_interval    month | year
 *   driver_limit        drivers included in the plan (NULL = unlimited)
 *   extra_drivers       paid add-on drivers on top of driver_limit
 *   subscription_status Stripe's status: trialing, active, past_due,
 *                       canceled, unpaid, incomplete, paused…
 *
 * Kept in sync by the Stripe webhook (checkout + subscription events), which
 * finds the lab by stripe_customer_id.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("labs", (table) => {
    table.string("plan").nullable();
    table.string("billing_interval").nullable();
    table.integer("driver_limit").nullable();
    table.integer("extra_drivers").notNullable().defaultTo(0);
    table.string("stripe_customer_id").nullable().unique();
    table.string("stripe_subscription_id").nullable().unique();
    table.string("subscription_status").nullable();
    table.timestamp("trial_ends_at").nullable();
    table.timestamp("current_period_end").nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("labs", (table) => {
    table.dropColumn("plan");
    table.dropColumn("billing_interval");
    table.dropColumn("driver_limit");
    table.dropColumn("extra_drivers");
    table.dropColumn("stripe_customer_id");
    table.dropColumn("stripe_subscription_id");
    table.dropColumn("subscription_status");
    table.dropColumn("trial_ends_at");
    table.dropColumn("current_period_end");
  });
};
