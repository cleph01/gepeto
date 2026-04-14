/**
 * Add email column to drivers table.
 * Nullable so existing rows aren't broken; new rows will always have it.
 */
exports.up = async function (knex) {
  await knex.schema.table('drivers', (table) => {
    table.string('email').nullable().unique();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('drivers', (table) => {
    table.dropColumn('email');
  });
};
