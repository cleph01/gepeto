/**
 * Driver breaks. While set, the driver's location isn't recorded and is hidden
 * from the lab and offices. The last known location stays in current_location.
 * Only the driver ends a break; nothing clears this automatically.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("drivers", (table) => {
    table.timestamp("on_break_since", { useTz: true }).nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("drivers", (table) => {
    table.dropColumn("on_break_since");
  });
};
