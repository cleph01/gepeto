/**
 * Add an optional expected-delivery time to jobs, so the late-delivery
 * cron alert has a real baseline instead of referencing a column that
 * never existed. Nullable — jobs without one simply never trigger the
 * late-delivery check (see api/cron/alerts/route.ts).
 */
exports.up = async function (knex) {
  await knex.schema.table('jobs', (table) => {
    table.timestamp('scheduled_at').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('jobs', (table) => {
    table.dropColumn('scheduled_at');
  });
};
