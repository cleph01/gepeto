/**
 * Add jobs and drivers tables to the supabase_realtime publication so that
 * Postgres Changes subscriptions work in the browser client.
 */
exports.up = async function (knex) {
  // Use DO block so it's idempotent — safe to run even if tables are already published
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'jobs'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'drivers'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE drivers;
      END IF;
    END $$;
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'jobs'
      ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE jobs;
      END IF;

      IF EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'drivers'
      ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE drivers;
      END IF;
    END $$;
  `);
};
