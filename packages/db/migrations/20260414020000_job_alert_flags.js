/**
 * Add alert-sent timestamps to jobs so the cron doesn't send duplicate emails.
 */
exports.up = async function (knex) {
  await knex.schema.table('jobs', (table) => {
    table.timestamp('unassigned_alerted_at').nullable();
    table.timestamp('late_alerted_at').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('jobs', (table) => {
    table.dropColumn('unassigned_alerted_at');
    table.dropColumn('late_alerted_at');
  });
};
