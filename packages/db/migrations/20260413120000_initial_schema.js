/**
 * Initial schema — all six core tables
 *
 * Table order matters for foreign key constraints:
 *   labs → lab_users, offices, drivers → jobs → messages
 */

exports.up = async function (knex) {
  // ── labs ──────────────────────────────────────────────────────────────────
  await knex.schema.createTable('labs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('address').notNullable();
    table.string('phone').notNullable();
    table.jsonb('settings').notNullable().defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });

  // ── lab_users (dispatchers) ───────────────────────────────────────────────
  await knex.schema.createTable('lab_users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('lab_id').notNullable().references('id').inTable('labs').onDelete('CASCADE');
    table.uuid('user_id').notNullable(); // FK to auth.users (managed by Supabase)
    table.string('name').notNullable();
    table.string('email').notNullable();
    table.enum('lab_role', ['owner', 'dispatcher']).notNullable().defaultTo('dispatcher');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('lab_id');
    table.index('user_id');
  });

  // ── offices ───────────────────────────────────────────────────────────────
  await knex.schema.createTable('offices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('lab_id').notNullable().references('id').inTable('labs').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('address').notNullable();
    table.string('phone').notNullable();
    table.string('contact_name').notNullable();
    table.string('tracking_token').notNullable().unique();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('lab_id');
    table.index('tracking_token');
  });

  // ── drivers ───────────────────────────────────────────────────────────────
  await knex.schema.createTable('drivers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('lab_id').notNullable().references('id').inTable('labs').onDelete('CASCADE');
    table.uuid('user_id').nullable(); // FK to auth.users
    table.string('name').notNullable();
    table.string('phone').notNullable();
    table.enum('status', ['available', 'on_delivery', 'off_duty']).notNullable().defaultTo('available');
    table.jsonb('current_location').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('lab_id');
    table.index('user_id');
  });

  // ── jobs ──────────────────────────────────────────────────────────────────
  await knex.schema.createTable('jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('case_id').notNullable();
    table.uuid('lab_id').notNullable().references('id').inTable('labs').onDelete('CASCADE');
    table.uuid('driver_id').nullable().references('id').inTable('drivers').onDelete('SET NULL');
    table.uuid('office_id').notNullable().references('id').inTable('offices').onDelete('CASCADE');
    table.enum('status', ['pending', 'assigned', 'picked_up', 'in_transit', 'arrived', 'delivered', 'rejected'])
      .notNullable().defaultTo('pending');
    table.enum('priority', ['stat', 'standard']).notNullable().defaultTo('standard');
    table.enum('driver_response', ['pending', 'accepted', 'rejected']).notNullable().defaultTo('pending');
    table.jsonb('items').notNullable().defaultTo('[]');
    table.string('pickup_address').notNullable();
    table.string('delivery_address').notNullable();
    table.jsonb('proof_of_delivery').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('delivered_at').nullable();
    table.index('lab_id');
    table.index('driver_id');
    table.index('office_id');
    table.index('status');
  });

  // Auto-update jobs.updated_at on every UPDATE
  await knex.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `);

  // ── messages ──────────────────────────────────────────────────────────────
  await knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('job_id').notNullable().references('id').inTable('jobs').onDelete('CASCADE');
    table.enum('sender_role', ['dispatcher', 'driver', 'office']).notNullable();
    table.uuid('sender_id').nullable();
    table.string('office_token').nullable();
    table.text('body').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('read_at').nullable();
    table.index('job_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('messages');
  await knex.raw('DROP TRIGGER IF EXISTS jobs_updated_at ON jobs');
  await knex.raw('DROP FUNCTION IF EXISTS update_updated_at');
  await knex.schema.dropTableIfExists('jobs');
  await knex.schema.dropTableIfExists('drivers');
  await knex.schema.dropTableIfExists('offices');
  await knex.schema.dropTableIfExists('lab_users');
  await knex.schema.dropTableIfExists('labs');
};
