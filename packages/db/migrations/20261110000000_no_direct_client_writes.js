/**
 * Browsers and phones can read through Supabase but no longer write.
 *
 * The first RLS policies let a signed-in dispatcher change their own lab's rows
 * with the public key, and Supabase's default grants allowed it. That skipped
 * every check in the API: roles, plan limits, read-only after a subscription
 * ends, and the history logs. It even let them edit their own plan and
 * subscription status. All writes already go through the API, whose server
 * connection isn't affected.
 *
 * Dispatchers keep read access, because live updates rely on it. Default
 * privileges change too, so new tables aren't writable by clients either.
 */
const labIdFromJwt = `(auth.jwt() -> 'app_metadata' ->> 'lab_id')`;
const roleFromJwt = `(auth.jwt() -> 'app_metadata' ->> 'role')`;
const isDispatcherOf = (column) => `${column}::text = ${labIdFromJwt} AND ${roleFromJwt} = 'dispatcher'`;
const MESSAGE_RULE = `EXISTS (SELECT 1 FROM jobs j WHERE j.id = messages.job_id AND ${isDispatcherOf("j.lab_id")})`;
const WRITES = "INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER";

exports.up = async function (knex) {
  await knex.raw(`
    DROP POLICY IF EXISTS labs_update ON labs;
    DROP POLICY IF EXISTS offices_write ON offices;

    DROP POLICY IF EXISTS jobs_dispatcher ON jobs;
    CREATE POLICY jobs_dispatcher ON jobs FOR SELECT USING (${isDispatcherOf("lab_id")});

    DROP POLICY IF EXISTS drivers_dispatcher ON drivers;
    CREATE POLICY drivers_dispatcher ON drivers FOR SELECT USING (${isDispatcherOf("lab_id")});

    DROP POLICY IF EXISTS messages_dispatcher ON messages;
    CREATE POLICY messages_dispatcher ON messages FOR SELECT USING (${MESSAGE_RULE});

    REVOKE ${WRITES} ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ${WRITES} ON TABLES FROM anon, authenticated;
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ${WRITES} ON TABLES TO anon, authenticated;
    GRANT ${WRITES} ON labs, jobs, drivers, messages, lab_users, job_status_events, job_edit_events, message_reads, returns, return_events, return_messages, return_message_reads, lab_deletions TO anon, authenticated;

    DROP POLICY IF EXISTS jobs_dispatcher ON jobs;
    CREATE POLICY jobs_dispatcher ON jobs FOR ALL USING (${isDispatcherOf("lab_id")});

    DROP POLICY IF EXISTS drivers_dispatcher ON drivers;
    CREATE POLICY drivers_dispatcher ON drivers FOR ALL USING (${isDispatcherOf("lab_id")});

    DROP POLICY IF EXISTS messages_dispatcher ON messages;
    CREATE POLICY messages_dispatcher ON messages FOR ALL USING (${MESSAGE_RULE});

    CREATE POLICY offices_write ON offices FOR ALL USING (${isDispatcherOf("lab_id")});
    CREATE POLICY labs_update ON labs FOR UPDATE USING (${isDispatcherOf("id")});
  `);
};
