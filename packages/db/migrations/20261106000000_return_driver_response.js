/**
 * Lets a driver accept or reject an assigned office pickup, like a job.
 *
 *   pending   dispatch assigned the pickup and the driver hasn't answered
 *   accepted  the driver took it, or logged the cases themselves
 *
 * Rejecting clears driver_id and returns the pickup to dispatch, so a row is
 * never left "rejected". Pickups assigned before this existed count as
 * accepted, so nothing already in a driver's list has to be answered again.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable("returns", (table) => {
    table.text("driver_response").notNullable().defaultTo("pending");
  });
  await knex("returns").whereNotNull("driver_id").update({ driver_response: "accepted" });
  await knex.raw(`
    ALTER TABLE returns ADD CONSTRAINT returns_driver_response_check
      CHECK (driver_response IN ('pending', 'accepted'));

    ALTER TABLE return_events DROP CONSTRAINT IF EXISTS return_events_event_check;
    ALTER TABLE return_events ADD CONSTRAINT return_events_event_check
      CHECK (event IN ('requested', 'assigned', 'driver_accepted', 'driver_rejected', 'cancelled',
                       'logged', 'dropped_at_lab', 'checked_in', 'linked', 'redelivery_created', 'edited'));
  `);
};

exports.down = async function (knex) {
  await knex("return_events").whereIn("event", ["driver_accepted", "driver_rejected"]).del();
  await knex.raw(`
    ALTER TABLE return_events DROP CONSTRAINT IF EXISTS return_events_event_check;
    ALTER TABLE return_events ADD CONSTRAINT return_events_event_check
      CHECK (event IN ('requested', 'assigned', 'cancelled', 'logged', 'dropped_at_lab',
                       'checked_in', 'linked', 'redelivery_created', 'edited'));
  `);
  await knex.schema.alterTable("returns", (table) => {
    table.dropColumn("driver_response");
  });
};
