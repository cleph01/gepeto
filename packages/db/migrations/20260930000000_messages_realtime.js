/**
 * The `messages` table was created with realtime chat in mind (driver-app
 * already subscribes to INSERT events on it) but was never added to the
 * supabase_realtime publication, so those subscriptions silently never fire.
 */
exports.up = async function (knex) {
  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
      ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
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
        WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
      ) THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE messages;
      END IF;
    END $$;
  `);
};
