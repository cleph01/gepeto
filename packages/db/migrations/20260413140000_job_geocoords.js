/**
 * Add geocoded delivery coordinates to jobs table.
 * Nullable — existing/future jobs without a geocodable address will stay null.
 */
exports.up = async function (knex) {
  await knex.schema.table('jobs', (table) => {
    table.float('delivery_lat').nullable();
    table.float('delivery_lng').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.table('jobs', (table) => {
    table.dropColumn('delivery_lat');
    table.dropColumn('delivery_lng');
  });
};
