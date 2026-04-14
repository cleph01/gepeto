/**
 * Row Level Security (RLS) policies
 *
 * Strategy:
 *   - All DB writes from the app go through the dispatcher-web API routes,
 *     which use the service-role key (bypasses RLS). RLS is a safety net
 *     for any direct Supabase client access (e.g. driver-app Realtime reads).
 *   - Dispatchers can see/modify everything belonging to their lab.
 *   - Drivers can see only their own lab's jobs (and only the ones assigned to them).
 *   - The JWT claim `app_metadata.lab_id` is set when a user is provisioned.
 */

exports.up = async function (knex) {
  // Helper: get lab_id from the JWT app_metadata (set server-side at user creation)
  const labIdFromJwt = `(auth.jwt() -> 'app_metadata' ->> 'lab_id')`;
  const roleFromJwt  = `(auth.jwt() -> 'app_metadata' ->> 'role')`;
  const driverIdFromJwt = `(auth.jwt() -> 'app_metadata' ->> 'driver_id')`;

  // ── Enable RLS on all tables ──────────────────────────────────────────────
  for (const table of ["labs", "lab_users", "offices", "drivers", "jobs", "messages"]) {
    await knex.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    // Drop default-deny fallback (it's already the default, but be explicit)
    await knex.raw(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
  }

  // ── labs ─────────────────────────────────────────────────────────────────
  // Dispatchers and drivers can read their own lab row
  await knex.raw(`
    CREATE POLICY labs_select ON labs
      FOR SELECT
      USING (id::text = ${labIdFromJwt})
  `);

  // Only dispatchers can update
  await knex.raw(`
    CREATE POLICY labs_update ON labs
      FOR UPDATE
      USING (id::text = ${labIdFromJwt} AND ${roleFromJwt} = 'dispatcher')
  `);

  // ── lab_users ─────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE POLICY lab_users_select ON lab_users
      FOR SELECT
      USING (lab_id::text = ${labIdFromJwt})
  `);

  // ── offices ──────────────────────────────────────────────────────────────
  await knex.raw(`
    CREATE POLICY offices_select ON offices
      FOR SELECT
      USING (lab_id::text = ${labIdFromJwt})
  `);

  await knex.raw(`
    CREATE POLICY offices_write ON offices
      FOR ALL
      USING (lab_id::text = ${labIdFromJwt} AND ${roleFromJwt} = 'dispatcher')
  `);

  // ── drivers ──────────────────────────────────────────────────────────────
  // Dispatchers see all drivers in their lab
  await knex.raw(`
    CREATE POLICY drivers_dispatcher ON drivers
      FOR ALL
      USING (lab_id::text = ${labIdFromJwt} AND ${roleFromJwt} = 'dispatcher')
  `);

  // Drivers can see their own row
  await knex.raw(`
    CREATE POLICY drivers_self ON drivers
      FOR SELECT
      USING (id::text = ${driverIdFromJwt})
  `);

  // Drivers can update their own location
  await knex.raw(`
    CREATE POLICY drivers_self_update ON drivers
      FOR UPDATE
      USING (id::text = ${driverIdFromJwt})
      WITH CHECK (id::text = ${driverIdFromJwt})
  `);

  // ── jobs ─────────────────────────────────────────────────────────────────
  // Dispatchers: full access to their lab's jobs
  await knex.raw(`
    CREATE POLICY jobs_dispatcher ON jobs
      FOR ALL
      USING (lab_id::text = ${labIdFromJwt} AND ${roleFromJwt} = 'dispatcher')
  `);

  // Drivers: can read jobs assigned to them (for Realtime subscriptions)
  await knex.raw(`
    CREATE POLICY jobs_driver_select ON jobs
      FOR SELECT
      USING (lab_id::text = ${labIdFromJwt} AND driver_id::text = ${driverIdFromJwt})
  `);

  // ── messages ─────────────────────────────────────────────────────────────
  // Messages are readable by anyone who can see the parent job
  // We join through jobs to enforce lab isolation
  await knex.raw(`
    CREATE POLICY messages_dispatcher ON messages
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM jobs j
          WHERE j.id = messages.job_id
            AND j.lab_id::text = ${labIdFromJwt}
            AND ${roleFromJwt} = 'dispatcher'
        )
      )
  `);

  await knex.raw(`
    CREATE POLICY messages_driver ON messages
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM jobs j
          WHERE j.id = messages.job_id
            AND j.driver_id::text = ${driverIdFromJwt}
        )
      )
  `);
};

exports.down = async function (knex) {
  const policies = [
    ["labs",      "labs_select"],
    ["labs",      "labs_update"],
    ["lab_users", "lab_users_select"],
    ["offices",   "offices_select"],
    ["offices",   "offices_write"],
    ["drivers",   "drivers_dispatcher"],
    ["drivers",   "drivers_self"],
    ["drivers",   "drivers_self_update"],
    ["jobs",      "jobs_dispatcher"],
    ["jobs",      "jobs_driver_select"],
    ["messages",  "messages_dispatcher"],
    ["messages",  "messages_driver"],
  ];

  for (const [table, policy] of policies) {
    await knex.raw(`DROP POLICY IF EXISTS ${policy} ON ${table}`);
  }

  for (const table of ["labs", "lab_users", "offices", "drivers", "jobs", "messages"]) {
    await knex.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
  }
};
