/**
 * full_neon_setup.js
 * 
 * Comprehensive script to ensure ALL tables, schemas, and columns
 * from the Eazzio Telecaller project are present in NeonDB.
 * 
 * Run with: node full_neon_setup.js
 */

const { Pool } = require('pg');
require('dotenv').config();

if (process.env.DB_TYPE !== 'postgres') {
  console.error('ERROR: Set DB_TYPE=postgres in .env to run this script.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run(client, sql, tag = '') {
  try {
    await client.query(sql);
    if (tag) console.log(`  ✓ ${tag}`);
  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('duplicate column')) {
      if (tag) console.log(`  ~ ${tag} (already exists)`);
    } else {
      console.error(`  ✗ ${tag || 'query'}: ${err.message}`);
    }
  }
}

async function setupPublicSchema(client) {
  console.log('\n══════════════════════════════════════════');
  console.log(' PUBLIC SCHEMA — Master Tables');
  console.log('══════════════════════════════════════════');

  await client.query('SET search_path TO "public"');

  // ── companies ──────────────────────────────────────────────────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      nature VARCHAR(100) NOT NULL,
      no_of_telecallers INTEGER DEFAULT 0,
      reg_num VARCHAR(50) UNIQUE NOT NULL,
      admin_email VARCHAR(100) UNIQUE NOT NULL,
      admin_password_hash VARCHAR(255) NOT NULL,
      admin_plain_password VARCHAR(255) NOT NULL,
      price_per_telecaller INTEGER DEFAULT 59,
      plan_type VARCHAR(20) DEFAULT 'monthly',
      subscription_start TIMESTAMP DEFAULT NULL,
      subscription_end TIMESTAMP DEFAULT NULL,
      edit_count INTEGER DEFAULT 0,
      mac_address VARCHAR(255),
      call_recording_enabled INTEGER DEFAULT 0,
      call_recording_end_date TIMESTAMP DEFAULT NULL,
      work_time_limit_hours INTEGER DEFAULT 8,
      talk_time_limit_hours INTEGER DEFAULT 4,
      proxy_limit_minutes INTEGER DEFAULT 10,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, 'companies table');

  // ── users (public/superadmin) ──────────────────────────────────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'telecaller',
      status VARCHAR(20) DEFAULT 'offline',
      last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      plain_password VARCHAR(255),
      current_token TEXT,
      profile_photo TEXT DEFAULT NULL
    )
  `, 'users table');

  // ── support_tickets ────────────────────────────────────────────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS support_tickets (
      id SERIAL PRIMARY KEY,
      company_reg_num VARCHAR(50) NOT NULL,
      company_name VARCHAR(100) NOT NULL,
      admin_email VARCHAR(100) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      image_url VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    )
  `, 'support_tickets table');

  // ── password_resets ────────────────────────────────────────────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      email VARCHAR(100) NOT NULL,
      otp VARCHAR(6) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, 'password_resets table');

  // ── contacts (public schema — for import/bulk operations) ──────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER,
      name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      assigned_to INTEGER,
      added_by INTEGER,
      last_called_at TIMESTAMP,
      follow_up_date TIMESTAMP,
      follow_up_started_at TIMESTAMP,
      try_count INTEGER DEFAULT 0,
      last_try_date DATE DEFAULT NULL,
      response_1 TEXT,
      response_2 TEXT,
      response_3 TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, 'contacts table (public)');

  // ── ALTER: add any missing columns ────────────────────────────────────────
  const publicAlters = [
    ["ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan_type VARCHAR(20) DEFAULT 'monthly'", 'companies.plan_type'],
    ["ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMP", 'companies.subscription_start'],
    ["ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMP", 'companies.subscription_end'],
    ["ALTER TABLE companies ADD COLUMN IF NOT EXISTS edit_count INTEGER DEFAULT 0", 'companies.edit_count'],
    ["ALTER TABLE companies ADD COLUMN IF NOT EXISTS mac_address VARCHAR(255)", 'companies.mac_address'],
    ["ALTER TABLE companies ADD COLUMN IF NOT EXISTS call_recording_enabled INTEGER DEFAULT 0", 'companies.call_recording_enabled'],
    ["ALTER TABLE companies ADD COLUMN IF NOT EXISTS call_recording_end_date TIMESTAMP", 'companies.call_recording_end_date'],
    ["ALTER TABLE companies ADD COLUMN IF NOT EXISTS work_time_limit_hours INTEGER DEFAULT 8", 'companies.work_time_limit_hours'],
    ["ALTER TABLE companies ADD COLUMN IF NOT EXISTS talk_time_limit_hours INTEGER DEFAULT 4", 'companies.talk_time_limit_hours'],
    ["ALTER TABLE companies ADD COLUMN IF NOT EXISTS proxy_limit_minutes INTEGER DEFAULT 10", 'companies.proxy_limit_minutes'],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password VARCHAR(255)", 'users.plain_password'],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS current_token TEXT", 'users.current_token'],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT", 'users.profile_photo'],
    ["ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS image_url VARCHAR(255)", 'support_tickets.image_url'],
    ["ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP", 'support_tickets.resolved_at'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_started_at TIMESTAMP", 'contacts.follow_up_started_at'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS added_by INTEGER", 'contacts.added_by'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS try_count INTEGER DEFAULT 0", 'contacts.try_count'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_try_date DATE DEFAULT NULL", 'contacts.last_try_date'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_1 TEXT", 'contacts.response_1'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_2 TEXT", 'contacts.response_2'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_3 TEXT", 'contacts.response_3'],
    ["ALTER TABLE contacts ALTER COLUMN phone_number TYPE VARCHAR(50)", 'contacts.phone_number → VARCHAR(50)'],
    ["ALTER TABLE contacts ALTER COLUMN name TYPE VARCHAR(255)", 'contacts.name → VARCHAR(255)'],
  ];

  for (const [sql, tag] of publicAlters) {
    await run(client, sql, tag);
  }

  console.log('\n  ✅ Public schema complete.');
}

async function setupCompanySchema(client, schemaName) {
  console.log(`\n══════════════════════════════════════════`);
  console.log(` TENANT SCHEMA: ${schemaName}`);
  console.log(`══════════════════════════════════════════`);

  await run(client, `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`, `schema "${schemaName}"`);
  await client.query(`SET search_path TO "${schemaName}"`);

  // ── users ──────────────────────────────────────────────────────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'telecaller',
      status VARCHAR(20) DEFAULT 'offline',
      last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      plain_password VARCHAR(255),
      current_token TEXT,
      profile_photo TEXT DEFAULT NULL
    )
  `, 'users');

  // ── campaigns ──────────────────────────────────────────────────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, 'campaigns');

  // ── contacts ───────────────────────────────────────────────────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      last_called_at TIMESTAMP,
      follow_up_date TIMESTAMP,
      follow_up_started_at TIMESTAMP,
      try_count INTEGER DEFAULT 0,
      last_try_date DATE DEFAULT NULL,
      response_1 TEXT,
      response_2 TEXT,
      response_3 TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, 'contacts');

  // ── call_logs ──────────────────────────────────────────────────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS call_logs (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      telecaller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      call_status VARCHAR(20) NOT NULL,
      duration INTEGER DEFAULT 0,
      feedback TEXT,
      recording_url TEXT,
      called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, 'call_logs');

  // ── lead_transfers ─────────────────────────────────────────────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS lead_transfers (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) DEFAULT 'pending',
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, 'lead_transfers');

  // ── telecaller_sessions ────────────────────────────────────────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS telecaller_sessions (
      id SERIAL PRIMARY KEY,
      telecaller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date DATE DEFAULT CURRENT_DATE,
      total_working_time INTEGER DEFAULT 0,
      total_calling_time INTEGER DEFAULT 0,
      total_idle_time INTEGER DEFAULT 0,
      total_break_time INTEGER DEFAULT 0,
      whatsapp_messages_count INTEGER DEFAULT 0,
      last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (telecaller_id, date)
    )
  `, 'telecaller_sessions');

  // ── admin_notifications ────────────────────────────────────────────────────
  await run(client, `
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id SERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, 'admin_notifications');

  // ── ALTER: add missing columns (idempotent) ────────────────────────────────
  const tenantAlters = [
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password VARCHAR(255)", 'users.plain_password'],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS current_token TEXT", 'users.current_token'],
    ["ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT DEFAULT NULL", 'users.profile_photo'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS follow_up_started_at TIMESTAMP", 'contacts.follow_up_started_at'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS added_by INTEGER REFERENCES users(id) ON DELETE SET NULL", 'contacts.added_by'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS try_count INTEGER DEFAULT 0", 'contacts.try_count'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_try_date DATE DEFAULT NULL", 'contacts.last_try_date'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_1 TEXT", 'contacts.response_1'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_2 TEXT", 'contacts.response_2'],
    ["ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_3 TEXT", 'contacts.response_3'],
    ["ALTER TABLE contacts ALTER COLUMN phone_number TYPE VARCHAR(50)", 'contacts.phone_number → VARCHAR(50)'],
    ["ALTER TABLE contacts ALTER COLUMN name TYPE VARCHAR(255)", 'contacts.name → VARCHAR(255)'],
    ["ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_url TEXT", 'call_logs.recording_url'],
    ["ALTER TABLE telecaller_sessions ADD COLUMN IF NOT EXISTS total_idle_time INTEGER DEFAULT 0", 'telecaller_sessions.total_idle_time'],
    ["ALTER TABLE telecaller_sessions ADD COLUMN IF NOT EXISTS whatsapp_messages_count INTEGER DEFAULT 0", 'telecaller_sessions.whatsapp_messages_count'],
  ];

  for (const [sql, tag] of tenantAlters) {
    await run(client, sql, tag);
  }

  console.log(`\n  ✅ Schema ${schemaName} complete.`);
}

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Eazzio NeonDB Full Schema Setup        ║');
  console.log('╚══════════════════════════════════════════╝');

  const client = await pool.connect();
  try {
    // 1. Setup public schema
    await setupPublicSchema(client);

    // 2. Get all registered companies from public.companies
    await client.query('SET search_path TO "public"');
    const companiesRes = await client.query('SELECT reg_num, name, admin_email, admin_password_hash, admin_plain_password FROM companies');
    const companies = companiesRes.rows;

    // 3. Scan for any other existing company schemas in the database catalog to ensure they are also updated
    const schemasRes = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'company_%'
    `);
    const existingSchemas = schemasRes.rows.map(r => r.schema_name);

    // Combine both sets of schemas to provision
    const schemasToProvision = new Set();
    for (const company of companies) {
      schemasToProvision.add(`company_${company.reg_num}`);
    }
    for (const schemaName of existingSchemas) {
      schemasToProvision.add(schemaName);
    }

    if (schemasToProvision.size === 0) {
      console.log('\n⚠  No company schemas found — skipping tenant schema setup.');
    } else {
      console.log(`\nFound ${schemasToProvision.size} company tenant schema(s) → provisioning...`);
      for (const schemaName of schemasToProvision) {
        await setupCompanySchema(client, schemaName);
      }
    }

    console.log('\n\n╔══════════════════════════════════════════╗');
    console.log('║  ✅  Full NeonDB setup COMPLETE!          ║');
    console.log('╚══════════════════════════════════════════╝\n');

    // Summary
    console.log('PUBLIC SCHEMA tables:');
    console.log('  • companies');
    console.log('  • users');
    console.log('  • support_tickets');
    console.log('  • password_resets');
    console.log('  • contacts');
    console.log('');
    console.log('TENANT SCHEMA tables (per company):');
    console.log('  • users');
    console.log('  • campaigns');
    console.log('  • contacts');
    console.log('  • call_logs');
    console.log('  • lead_transfers');
    console.log('  • telecaller_sessions');
    console.log('  • admin_notifications');

  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
