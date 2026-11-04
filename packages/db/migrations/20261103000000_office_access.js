/**
 * Office tracking link hardening.
 *
 *  - Shared access code per office. The link alone shows basic status; the code
 *    unlocks the rest. Stored encrypted (not hashed) because the lab has to be
 *    able to read and copy it. access_version is bumped on reset, which signs
 *    out every device using the old code.
 *  - Guessable tokens (seed data) replaced with random ones.
 *  - Offices: the browser roles can't read tracking_token or the code. Drivers
 *    can read offices in their lab, and would otherwise get every office's link.
 *  - Messages no longer keep a copy of the token.
 *  - Drivers can read their messages but not write them directly, and can't
 *    change their own driver record directly. Both go through the API.
 *  - knex's own tables had RLS off with full grants to the public key.
 */
const PUBLIC_OFFICE_COLUMNS = "id, lab_id, name, address, phone, contact_name, created_at";

exports.up = async function (knex) {
  for (const table of ["knex_migrations", "knex_migrations_lock"]) {
    await knex.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    await knex.raw(`REVOKE ALL ON ${table} FROM anon, authenticated`);
  }

  await knex.schema.alterTable("offices", (table) => {
    table.string("email").nullable();
    table.text("access_code_enc").nullable();
    table.integer("access_version").notNullable().defaultTo(1);
  });

  await knex.raw(`
    UPDATE offices SET tracking_token = gen_random_uuid()::text
    WHERE tracking_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  `);

  await knex.raw("REVOKE ALL ON offices FROM anon, authenticated");
  await knex.raw(`GRANT SELECT (${PUBLIC_OFFICE_COLUMNS}) ON offices TO authenticated`);

  await knex.raw("UPDATE messages SET office_token = NULL WHERE office_token IS NOT NULL");

  const driverIdFromJwt = `(auth.jwt() -> 'app_metadata' ->> 'driver_id')`;
  await knex.raw("DROP POLICY IF EXISTS messages_driver ON messages");
  await knex.raw(`
    CREATE POLICY messages_driver ON messages
      FOR SELECT
      USING (EXISTS (
        SELECT 1 FROM jobs j WHERE j.id = messages.job_id AND j.driver_id::text = ${driverIdFromJwt}
      ))
  `);
  await knex.raw("DROP POLICY IF EXISTS drivers_self_update ON drivers");

  // Fixed-window counters for the public routes. Keys are hashed, so no token
  // or IP is stored here.
  await knex.schema.createTable("rate_limits", (table) => {
    table.string("key").primary();
    table.timestamp("window_start").notNullable().defaultTo(knex.fn.now());
    table.integer("count").notNullable().defaultTo(0);
  });
  await knex.raw("ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY");
  await knex.raw("ALTER TABLE rate_limits FORCE ROW LEVEL SECURITY");
  await knex.raw("REVOKE ALL ON rate_limits FROM anon, authenticated");
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("rate_limits");

  const driverIdFromJwt = `(auth.jwt() -> 'app_metadata' ->> 'driver_id')`;
  await knex.raw("DROP POLICY IF EXISTS messages_driver ON messages");
  await knex.raw(`
    CREATE POLICY messages_driver ON messages
      FOR ALL
      USING (EXISTS (
        SELECT 1 FROM jobs j WHERE j.id = messages.job_id AND j.driver_id::text = ${driverIdFromJwt}
      ))
  `);
  await knex.raw(`
    CREATE POLICY drivers_self_update ON drivers
      FOR UPDATE
      USING (id::text = ${driverIdFromJwt})
      WITH CHECK (id::text = ${driverIdFromJwt})
  `);

  await knex.raw("GRANT ALL ON offices TO anon, authenticated");
  await knex.schema.alterTable("offices", (table) => {
    table.dropColumn("email");
    table.dropColumn("access_code_enc");
    table.dropColumn("access_version");
  });

  for (const table of ["knex_migrations", "knex_migrations_lock"]) {
    await knex.raw(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY`);
    await knex.raw(`GRANT ALL ON ${table} TO anon, authenticated`);
  }
};
