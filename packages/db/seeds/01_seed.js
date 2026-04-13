require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

/**
 * Seed data — one lab, two dispatchers, two drivers, two offices, four jobs.
 *
 * Auth users are created via the Supabase Admin API (service role key).
 * Credentials for test accounts:
 *
 *   Dispatcher:  dispatcher@gepeto.dev  /  SeedPass1!
 *   Driver 1:    driver1@gepeto.dev     /  SeedPass1!
 *   Driver 2:    driver2@gepeto.dev     /  SeedPass1!
 *
 * Run with:  pnpm --filter @gepeto/db seed
 */

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function upsertAuthUser(email, password, metadata) {
  // Check if user already exists
  const { data: list } = await supabaseAdmin.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === email);
  if (existing) {
    console.log(`  ↳ Auth user already exists: ${email} (${existing.id})`);
    return existing.id;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: metadata,
    email_confirm: true,
  });

  if (error) throw new Error(`Failed to create auth user ${email}: ${error.message}`);
  console.log(`  ↳ Created auth user: ${email} (${data.user.id})`);
  return data.user.id;
}

// ─── Seed ────────────────────────────────────────────────────────────────────

exports.seed = async function (knex) {
  console.log('\n🌱 Seeding Gepeto database...\n');

  // ── 1. Lab ────────────────────────────────────────────────────────────────
  console.log('Creating lab...');
  const [lab] = await knex('labs')
    .insert({
      name: 'Sunrise Dental Lab',
      address: '123 Lab Street, Los Angeles, CA 90001',
      phone: '(213) 555-0100',
      settings: JSON.stringify({
        notification_email: 'dispatch@sunriselab.com',
        sms_enabled: false,
      }),
    })
    .returning('*')
    .onConflict()
    .ignore();

  // If already seeded, fetch the existing lab
  const labId = lab?.id ?? (await knex('labs').where('name', 'Sunrise Dental Lab').first()).id;
  console.log(`  ↳ Lab ID: ${labId}\n`);

  // ── 2. Auth users ─────────────────────────────────────────────────────────
  console.log('Creating auth users...');

  const dispatcherUserId = await upsertAuthUser(
    'dispatcher@gepeto.dev',
    'SeedPass1!',
    { role: 'dispatcher', lab_role: 'owner', lab_id: labId }
  );

  const driver1UserId = await upsertAuthUser(
    'driver1@gepeto.dev',
    'SeedPass1!',
    { role: 'driver' }
  );

  const driver2UserId = await upsertAuthUser(
    'driver2@gepeto.dev',
    'SeedPass1!',
    { role: 'driver' }
  );

  console.log();

  // ── 3. Lab user (dispatcher) ──────────────────────────────────────────────
  console.log('Creating lab user (dispatcher)...');
  const existingLabUser = await knex('lab_users').where('user_id', dispatcherUserId).first();
  if (!existingLabUser) {
    await knex('lab_users').insert({
      lab_id: labId,
      user_id: dispatcherUserId,
      name: 'Maria Gonzalez',
      email: 'dispatcher@gepeto.dev',
      lab_role: 'owner',
    });
    console.log('  ↳ Created dispatcher: Maria Gonzalez');
  } else {
    console.log('  ↳ Dispatcher already exists, skipping');
  }

  // ── 4. Drivers ────────────────────────────────────────────────────────────
  console.log('\nCreating drivers...');

  let driver1Id;
  const existingDriver1 = await knex('drivers').where('user_id', driver1UserId).first();
  if (!existingDriver1) {
    const [d1] = await knex('drivers')
      .insert({
        lab_id: labId,
        user_id: driver1UserId,
        name: 'James Carter',
        phone: '(213) 555-0111',
        status: 'available',
      })
      .returning('id');
    driver1Id = d1.id;
    // Backfill driver_id into auth user metadata now that we have the DB row UUID
    await supabaseAdmin.auth.admin.updateUserById(driver1UserId, {
      user_metadata: { role: 'driver', driver_id: driver1Id, lab_id: labId },
    });
    console.log(`  ↳ Created driver: James Carter (${driver1Id})`);
  } else {
    driver1Id = existingDriver1.id;
    console.log(`  ↳ Driver 1 already exists (${driver1Id}), skipping`);
  }

  let driver2Id;
  const existingDriver2 = await knex('drivers').where('user_id', driver2UserId).first();
  if (!existingDriver2) {
    const [d2] = await knex('drivers')
      .insert({
        lab_id: labId,
        user_id: driver2UserId,
        name: 'Sofia Reyes',
        phone: '(213) 555-0122',
        status: 'on_delivery',
      })
      .returning('id');
    driver2Id = d2.id;
    // Backfill driver_id into auth user metadata now that we have the DB row UUID
    await supabaseAdmin.auth.admin.updateUserById(driver2UserId, {
      user_metadata: { role: 'driver', driver_id: driver2Id, lab_id: labId },
    });
    console.log(`  ↳ Created driver: Sofia Reyes (${driver2Id})`);
  } else {
    driver2Id = existingDriver2.id;
    console.log(`  ↳ Driver 2 already exists (${driver2Id}), skipping`);
  }

  // ── 5. Offices ────────────────────────────────────────────────────────────
  console.log('\nCreating offices...');

  let office1Id;
  const existingOffice1 = await knex('offices').where('tracking_token', 'tok_beverly_hills_001').first();
  if (!existingOffice1) {
    const [o1] = await knex('offices')
      .insert({
        lab_id: labId,
        name: 'Beverly Hills Family Dentistry',
        address: '456 Dental Ave, Beverly Hills, CA 90210',
        phone: '(310) 555-0200',
        contact_name: 'Dr. Priya Patel',
        tracking_token: 'tok_beverly_hills_001',
      })
      .returning('id');
    office1Id = o1.id;
    console.log(`  ↳ Created office: Beverly Hills Family Dentistry (${office1Id})`);
  } else {
    office1Id = existingOffice1.id;
    console.log(`  ↳ Office 1 already exists (${office1Id}), skipping`);
  }

  let office2Id;
  const existingOffice2 = await knex('offices').where('tracking_token', 'tok_santa_monica_002').first();
  if (!existingOffice2) {
    const [o2] = await knex('offices')
      .insert({
        lab_id: labId,
        name: 'Santa Monica Smile Studio',
        address: '789 Smile Blvd, Santa Monica, CA 90401',
        phone: '(310) 555-0201',
        contact_name: 'Dr. Aaron Kim',
        tracking_token: 'tok_santa_monica_002',
      })
      .returning('id');
    office2Id = o2.id;
    console.log(`  ↳ Created office: Santa Monica Smile Studio (${office2Id})`);
  } else {
    office2Id = existingOffice2.id;
    console.log(`  ↳ Office 2 already exists (${office2Id}), skipping`);
  }

  // ── 6. Jobs ───────────────────────────────────────────────────────────────
  console.log('\nCreating jobs...');

  const existingJobs = await knex('jobs').where('lab_id', labId).count('id as count').first();
  if (parseInt(existingJobs.count) > 0) {
    console.log('  ↳ Jobs already exist, skipping');
  } else {
    await knex('jobs').insert([
      // New job — driver needs to accept
      {
        case_id: 'CS-2024-001',
        lab_id: labId,
        driver_id: driver1Id,
        office_id: office1Id,
        status: 'assigned',
        priority: 'stat',
        driver_response: 'pending',
        items: JSON.stringify([
          { description: 'Crown — Upper Right Molar', quantity: 1, flags: ['fragile'] },
        ]),
        pickup_address: '123 Lab Street, Los Angeles, CA 90001',
        delivery_address: '456 Dental Ave, Beverly Hills, CA 90210',
      },
      // In transit
      {
        case_id: 'CS-2024-002',
        lab_id: labId,
        driver_id: driver2Id,
        office_id: office2Id,
        status: 'in_transit',
        priority: 'standard',
        driver_response: 'accepted',
        items: JSON.stringify([
          { description: 'Implant Abutment', quantity: 2, flags: [] },
          { description: 'Night Guard', quantity: 1, flags: ['rush'] },
        ]),
        pickup_address: '123 Lab Street, Los Angeles, CA 90001',
        delivery_address: '789 Smile Blvd, Santa Monica, CA 90401',
      },
      // Delivered
      {
        case_id: 'CS-2024-003',
        lab_id: labId,
        driver_id: driver1Id,
        office_id: office1Id,
        status: 'delivered',
        priority: 'standard',
        driver_response: 'accepted',
        items: JSON.stringify([
          { description: 'Partial Denture', quantity: 1, flags: [] },
        ]),
        pickup_address: '123 Lab Street, Los Angeles, CA 90001',
        delivery_address: '456 Dental Ave, Beverly Hills, CA 90210',
        delivered_at: new Date().toISOString(),
      },
      // Pending assignment
      {
        case_id: 'CS-2024-004',
        lab_id: labId,
        driver_id: null,
        office_id: office2Id,
        status: 'pending',
        priority: 'standard',
        driver_response: 'pending',
        items: JSON.stringify([
          { description: 'Ceramic Veneer Set', quantity: 6, flags: ['fragile', 'temperature_sensitive'] },
        ]),
        pickup_address: '123 Lab Street, Los Angeles, CA 90001',
        delivery_address: '789 Smile Blvd, Santa Monica, CA 90401',
      },
    ]);
    console.log('  ↳ Created 4 sample jobs');
  }

  console.log('\n✅ Seed complete.\n');
  console.log('Test credentials:');
  console.log('  Dispatcher:  dispatcher@gepeto.dev  /  SeedPass1!');
  console.log('  Driver 1:    driver1@gepeto.dev     /  SeedPass1!');
  console.log('  Driver 2:    driver2@gepeto.dev     /  SeedPass1!\n');
};
