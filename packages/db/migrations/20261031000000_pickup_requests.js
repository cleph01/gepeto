/**
 * Pickup requests: an office says "we have cases ready to go back to the lab"
 * from its tracking page, before any driver is involved.
 *
 * A request is a return in a new first status:
 *
 *   requested    the office asked for a pickup. driver_id is empty until
 *                dispatch assigns one (assigned_at); the office can cancel
 *                until then.
 *   with_driver  the driver logged the pickup. A driver logging cases at an
 *                office fulfills that office's open request rather than
 *                creating a second return.
 *   at_lab / checked_in   unchanged.
 *   cancelled    withdrawn by the office or dispatch before pickup.
 *
 * picked_up_at becomes nullable (a request hasn't been picked up yet);
 * existing rows already have it. return_events gains office actions, which
 * have no user account behind them (actor_user_id becomes nullable).
 */
exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_status_check;
    ALTER TABLE returns ADD CONSTRAINT returns_status_check
      CHECK (status IN ('requested', 'with_driver', 'at_lab', 'checked_in', 'cancelled'));

    ALTER TABLE returns ALTER COLUMN picked_up_at DROP NOT NULL;
    ALTER TABLE returns ALTER COLUMN picked_up_at DROP DEFAULT;

    ALTER TABLE return_events DROP CONSTRAINT IF EXISTS return_events_event_check;
    ALTER TABLE return_events ADD CONSTRAINT return_events_event_check
      CHECK (event IN ('requested', 'assigned', 'cancelled', 'logged', 'dropped_at_lab',
                       'checked_in', 'linked', 'redelivery_created', 'edited'));

    ALTER TABLE return_events DROP CONSTRAINT IF EXISTS return_events_actor_role_check;
    ALTER TABLE return_events ADD CONSTRAINT return_events_actor_role_check
      CHECK (actor_role IN ('driver', 'dispatcher', 'office'));
    ALTER TABLE return_events ALTER COLUMN actor_user_id DROP NOT NULL;
  `);

  await knex.schema.alterTable("returns", (table) => {
    table.timestamp("requested_at").nullable(); // set only for office requests
    table.timestamp("ready_at").nullable();     // "ready after"; null = ready now
    table.timestamp("assigned_at").nullable();
    table.timestamp("cancelled_at").nullable();
  });
};

exports.down = async function (knex) {
  // Requests and cancellations have no place in the old model.
  await knex("return_events").whereIn("event", ["requested", "assigned", "cancelled"]).del();
  await knex("return_events").where("actor_role", "office").del();
  await knex("returns").whereIn("status", ["requested", "cancelled"]).del();

  await knex.schema.alterTable("returns", (table) => {
    table.dropColumn("requested_at");
    table.dropColumn("ready_at");
    table.dropColumn("assigned_at");
    table.dropColumn("cancelled_at");
  });

  await knex.raw(`
    UPDATE returns SET picked_up_at = created_at WHERE picked_up_at IS NULL;
    ALTER TABLE returns ALTER COLUMN picked_up_at SET DEFAULT now();
    ALTER TABLE returns ALTER COLUMN picked_up_at SET NOT NULL;

    ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_status_check;
    ALTER TABLE returns ADD CONSTRAINT returns_status_check
      CHECK (status IN ('with_driver', 'at_lab', 'checked_in'));

    ALTER TABLE return_events ALTER COLUMN actor_user_id SET NOT NULL;
    ALTER TABLE return_events DROP CONSTRAINT IF EXISTS return_events_event_check;
    ALTER TABLE return_events ADD CONSTRAINT return_events_event_check
      CHECK (event IN ('logged', 'dropped_at_lab', 'checked_in', 'linked', 'redelivery_created', 'edited'));
    ALTER TABLE return_events DROP CONSTRAINT IF EXISTS return_events_actor_role_check;
    ALTER TABLE return_events ADD CONSTRAINT return_events_actor_role_check
      CHECK (actor_role IN ('driver', 'dispatcher'));
  `);
};
