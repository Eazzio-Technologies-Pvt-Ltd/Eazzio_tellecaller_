const pg = require('pg');
const { Pool } = pg;
const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

// Override pg driver parsing for TIMESTAMP (OID 1114) to parse as UTC
pg.types.setTypeParser(1114, function(stringValue) {
  if (!stringValue) return null;
  // If it doesn't contain time zone indicators, append Z to force UTC parsing
  if (!stringValue.includes('T') && !stringValue.includes('Z') && !stringValue.includes('+')) {
    return new Date(stringValue.replace(' ', 'T') + 'Z');
  }
  return new Date(stringValue);
});

const dbType = 'postgres';
let pgPool = null;

// AsyncLocalStorage to hold company registration code context
const dbStorage = new AsyncLocalStorage();

// Helper to resolve company-specific databases directory (dynamic persistent storage support)
function getDatabasesDir() {
  return path.join(__dirname, '..', 'databases');
}

console.log('Database Config: Using PostgreSQL');
const connectionString = process.env.DATABASE_URL || process.env.NEON_DB_URL;
if (connectionString) {
  pgPool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  pgPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

pgPool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err.message);
});

/**
 * Executes a query with arguments on the tenant database (resolved dynamically).
 * Uses PostgreSQL ($1, $2) parameter syntax.
 */
async function query(text, params = []) {
  const store = dbStorage.getStore();
  const client = await pgPool.connect();
  const errorHandler = (err) => { console.error('Database client error:', err.message); };
  client.on('error', errorHandler);
  try {
    if (store && store.companyRegNum) {
      const schemaName = `company_${store.companyRegNum}`;
      await client.query(`SET search_path TO "${schemaName}", "public"`);
    } else {
      await client.query('SET search_path TO "public"');
    }
    return await client.query(text, params);
  } finally {
    client.removeListener('error', errorHandler);
    client.release();
  }
}

/**
 * Executes a query specifically on the main database (bypassing tenant routing).
 */
async function queryMain(text, params = []) {
  const client = await pgPool.connect();
  const errorHandler = (err) => { console.error('Database client error in queryMain:', err.message); };
  client.on('error', errorHandler);
  try {
    await client.query('SET search_path TO "public"');
    return await client.query(text, params);
  } finally {
    client.removeListener('error', errorHandler);
    client.release();
  }
}

/**
 * Sets up database tables if they do not exist.
 */
async function initializeSchema() {
  console.log('Initializing database schema...');

  const serialType = 'SERIAL PRIMARY KEY';
  const textType = 'TEXT';
  const timestampType = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
  const dateType = 'DATE DEFAULT CURRENT_DATE';

  const schemas = [
    // Companies table (Master Database Only)
    `CREATE TABLE IF NOT EXISTS companies (
      id ${serialType},
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
      created_at ${timestampType}
    )`,

    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id ${serialType},
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'telecaller',
      status VARCHAR(20) DEFAULT 'offline',
      last_active_at ${timestampType},
      created_at ${timestampType},
      profile_photo ${textType} DEFAULT NULL
    )`,

    // Campaigns table
    `CREATE TABLE IF NOT EXISTS campaigns (
      id ${serialType},
      name VARCHAR(100) NOT NULL,
      description ${textType},
      status VARCHAR(20) DEFAULT 'pending',
      created_by INTEGER REFERENCES users(id),
      created_at ${timestampType}
    )`,

    // Contacts table
    `CREATE TABLE IF NOT EXISTS contacts (
      id ${serialType},
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      last_called_at ${timestampType},
      follow_up_date ${timestampType},
      follow_up_started_at ${timestampType},
      try_count INTEGER DEFAULT 0,
      last_try_date ${dateType},
      response_1 ${textType},
      response_2 ${textType},
      response_3 ${textType},
      created_at ${timestampType}
    )`,

    // Call logs table
    `CREATE TABLE IF NOT EXISTS call_logs (
      id ${serialType},
      contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
      telecaller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      call_status VARCHAR(20) NOT NULL,
      duration INTEGER DEFAULT 0,
      feedback ${textType},
      recording_url ${textType},
      called_at ${timestampType}
    )`,

    // Telecaller sessions table
    `CREATE TABLE IF NOT EXISTS telecaller_sessions (
      id ${serialType},
      telecaller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      date ${dateType},
      total_working_time INTEGER DEFAULT 0,
      total_calling_time INTEGER DEFAULT 0,
      total_idle_time INTEGER DEFAULT 0,
      total_break_time INTEGER DEFAULT 0,
      whatsapp_messages_count INTEGER DEFAULT 0,
      last_updated_at ${timestampType},
      UNIQUE (telecaller_id, date)
    )`,

    // Admin notifications table
    `CREATE TABLE IF NOT EXISTS admin_notifications (
      id ${serialType},
      message ${textType} NOT NULL,
      created_at ${timestampType}
    )`,

    // Support Tickets table (main database - visible to superadmin across all companies)
    `CREATE TABLE IF NOT EXISTS support_tickets (
      id ${serialType},
      company_reg_num VARCHAR(50) NOT NULL,
      company_name VARCHAR(100) NOT NULL,
      admin_email VARCHAR(100) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message ${textType} NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      image_url VARCHAR(255) DEFAULT NULL,
      created_at ${timestampType},
      resolved_at ${timestampType}
    )`,

    // Password resets table (main database)
    `CREATE TABLE IF NOT EXISTS password_resets (
      id ${serialType},
      email VARCHAR(100) NOT NULL,
      otp VARCHAR(6) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at ${timestampType}
    )`
  ];

  for (const sql of schemas) {
    try {
      await queryMain(sql);
    } catch (err) {
      console.error('Error running migrations:', err);
      process.exit(1);
    }
  }

  // Add plain_password column if it doesn't exist
  try {
    await queryMain('ALTER TABLE users ADD COLUMN plain_password VARCHAR(255)');
    console.log('Added plain_password column to users table.');
  } catch (err) {
    // Column already exists, ignore
  }

  // Add current_token column to users table in main database
  try {
    await queryMain('ALTER TABLE users ADD COLUMN current_token TEXT');
    console.log('Added current_token column to users table in main database.');
  } catch (err) {
    // Column already exists, ignore
  }

  // Add profile_photo column to users table in main database
  try {
    await queryMain('ALTER TABLE users ADD COLUMN profile_photo TEXT');
    console.log('Added profile_photo column to users table in main database.');
  } catch (err) {
    // Column already exists, ignore
  }

  // Add follow_up_started_at column if it doesn't exist in main contacts table
  try {
    await queryMain('ALTER TABLE contacts ADD COLUMN follow_up_started_at TIMESTAMP');
    console.log('Added follow_up_started_at column to contacts table in main db.');
  } catch (err) {
    // Column already exists, ignore
  }

  // Add edit_count column if it doesn't exist in companies table
  try {
    await queryMain('ALTER TABLE companies ADD COLUMN edit_count INTEGER DEFAULT 0');
    console.log('Added edit_count column to companies table.');
  } catch (err) {
    // Column already exists, ignore
  }

  // Add plan_type, subscription_start, subscription_end columns if missing
  try {
    await queryMain("ALTER TABLE companies ADD COLUMN plan_type VARCHAR(20) DEFAULT 'monthly'");
    console.log('Added plan_type column to companies table.');
  } catch (err) { /* already exists */ }
  try {
    await queryMain('ALTER TABLE companies ADD COLUMN subscription_start TIMESTAMP');
    console.log('Added subscription_start column to companies table.');
  } catch (err) { /* already exists */ }
  try {
    await queryMain('ALTER TABLE companies ADD COLUMN subscription_end TIMESTAMP');
    console.log('Added subscription_end column to companies table.');
  } catch (err) { /* already exists */ }
  try {
    await queryMain('ALTER TABLE companies ADD COLUMN mac_address VARCHAR(255)');
    console.log('Added mac_address column to companies table.');
  } catch (err) { /* already exists */ }
  try {
    await queryMain('ALTER TABLE companies ADD COLUMN call_recording_enabled INTEGER DEFAULT 0');
    console.log('Added call_recording_enabled column to companies table.');
  } catch (err) { /* already exists */ }
  try {
    await queryMain('ALTER TABLE companies ADD COLUMN call_recording_end_date TIMESTAMP');
    console.log('Added call_recording_end_date column to companies table.');
  } catch (err) { /* already exists */ }

  // Add image_url column to support_tickets table if it doesn't exist
  try {
    await queryMain('ALTER TABLE support_tickets ADD COLUMN image_url VARCHAR(255)');
    console.log('Added image_url column to support_tickets table.');
  } catch (err) { /* already exists */ }

  // Create default admin user if none exists
  try {
    const adminCheck = await queryMain('SELECT * FROM users WHERE email = $1', ['tellecaller111@eazzio.com']);
    if (adminCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const adminPassHash = await bcrypt.hash('eazziotellecaller111', 10);
      
      // Check if old admin@eazzio.com exists to migrate it
      const oldAdminCheck = await queryMain('SELECT * FROM users WHERE email = $1', ['admin@eazzio.com']);
      if (oldAdminCheck.rows.length > 0) {
        await queryMain(
          'UPDATE users SET email = $1, password_hash = $2, plain_password = $3, name = $4 WHERE email = $5',
          ['tellecaller111@eazzio.com', adminPassHash, 'eazziotellecaller111', 'Admin User', 'admin@eazzio.com']
        );
        console.log('Migrated default admin user admin@eazzio.com to tellecaller111@eazzio.com / eazziotellecaller111');
      } else {
        await queryMain(
          'INSERT INTO users (name, email, password_hash, plain_password, role) VALUES ($1, $2, $3, $4, $5)',
          ['Admin User', 'tellecaller111@eazzio.com', adminPassHash, 'eazziotellecaller111', 'admin']
        );
        console.log('Created default admin user: tellecaller111@eazzio.com / eazziotellecaller111');
      }
    } else {
      // If tellecaller111@eazzio.com exists, make sure the password hash is correct
      const bcrypt = require('bcryptjs');
      const adminPassHash = await bcrypt.hash('eazziotellecaller111', 10);
      await queryMain(
        'UPDATE users SET password_hash = $1, plain_password = $2 WHERE email = $3',
        [adminPassHash, 'eazziotellecaller111', 'tellecaller111@eazzio.com']
      );
      console.log('Ensured tellecaller111@eazzio.com has the correct password hash');
    }
  } catch (err) {
    console.error('Error creating/migrating default admin user:', err);
  }

  // Migrate existing users with null plain_password to emailPrefix123
  try {
    const bcrypt = require('bcryptjs');
    const callersResult = await queryMain("SELECT id, email FROM users WHERE (plain_password IS NULL OR plain_password = '') AND role = 'telecaller'");
    for (const row of callersResult.rows) {
      const prefix = row.email.split('@')[0];
      const defaultPass = `${prefix}123`;
      const passHash = await bcrypt.hash(defaultPass, 10);
      await queryMain(
        "UPDATE users SET plain_password = $1, password_hash = $2 WHERE id = $3",
        [defaultPass, passHash, row.id]
      );
      console.log(`Migrated plain_password for ${row.email} to ${defaultPass}`);
    }
  } catch (err) {
    console.error('Error updating existing null plain_passwords:', err);
  }

  // Migrate contacts table column limits in main database and all dynamic PostgreSQL schemas
  try {
    // 1. Alter public database contacts and companies tables
    await queryMain('ALTER TABLE contacts ALTER COLUMN phone_number TYPE VARCHAR(50)');
    await queryMain('ALTER TABLE contacts ALTER COLUMN name TYPE VARCHAR(255)');
    try {
      await queryMain('ALTER TABLE contacts ADD COLUMN added_by INTEGER');
    } catch (e) {}

    // Add new columns to public companies, contacts, and telecaller_sessions
    try { await queryMain('ALTER TABLE companies ADD COLUMN IF NOT EXISTS work_time_limit_hours INTEGER DEFAULT 8'); } catch(e){}
    try { await queryMain('ALTER TABLE companies ADD COLUMN IF NOT EXISTS talk_time_limit_hours INTEGER DEFAULT 4'); } catch(e){}
    try { await queryMain('ALTER TABLE companies ADD COLUMN IF NOT EXISTS proxy_limit_minutes INTEGER DEFAULT 10'); } catch(e){}

    try { await queryMain('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS try_count INTEGER DEFAULT 0'); } catch(e){}
    try { await queryMain('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_try_date DATE DEFAULT NULL'); } catch(e){}
    try { await queryMain('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_1 TEXT DEFAULT NULL'); } catch(e){}
    try { await queryMain('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_2 TEXT DEFAULT NULL'); } catch(e){}
    try { await queryMain('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_3 TEXT DEFAULT NULL'); } catch(e){}

    try { await queryMain('ALTER TABLE telecaller_sessions ADD COLUMN IF NOT EXISTS whatsapp_messages_count INTEGER DEFAULT 0'); } catch(e){}

    console.log('Migrated public contacts and companies tables.');

    // 2. Alter dynamic schemas
    const companiesRes = await queryMain('SELECT reg_num FROM companies');
    for (const row of companiesRes.rows) {
      const schemaName = `company_${row.reg_num}`;
      try {
        const client = await pgPool.connect();
        const errorHandler = (err) => { console.error('Database client error in migration check:', err.message); };
        client.on('error', errorHandler);
        try {
          await client.query(`SET search_path TO "${schemaName}"`);
          await client.query('ALTER TABLE contacts ALTER COLUMN phone_number TYPE VARCHAR(50)');
          await client.query('ALTER TABLE contacts ALTER COLUMN name TYPE VARCHAR(255)');
          
          try { await client.query('ALTER TABLE contacts ADD COLUMN follow_up_started_at TIMESTAMP'); } catch (e) {}
          try { await client.query('ALTER TABLE contacts ADD COLUMN added_by INTEGER REFERENCES users(id) ON DELETE SET NULL'); } catch (e) {}
          try { await client.query('ALTER TABLE users ADD COLUMN profile_photo TEXT'); } catch (e) {}

          try { await client.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS try_count INTEGER DEFAULT 0'); } catch(e){}
          try { await client.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_try_date DATE DEFAULT NULL'); } catch(e){}
          try { await client.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_1 TEXT DEFAULT NULL'); } catch(e){}
          try { await client.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_2 TEXT DEFAULT NULL'); } catch(e){}
          try { await client.query('ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_3 TEXT DEFAULT NULL'); } catch(e){}

          try { await client.query('ALTER TABLE telecaller_sessions ADD COLUMN IF NOT EXISTS whatsapp_messages_count INTEGER DEFAULT 0'); } catch(e){}

          try {
            await client.query(`CREATE TABLE IF NOT EXISTS lead_transfers (
              id SERIAL PRIMARY KEY,
              contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
              from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
              to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
              status VARCHAR(20) DEFAULT 'pending',
              reason TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
          } catch (e) {}
          
          console.log(`Migrated columns in schema: ${schemaName}`);
        } finally {
          client.removeListener('error', errorHandler);
          client.release();
        }
      } catch (schemaErr) {
        console.error(`Failed to migrate schema ${schemaName}:`, schemaErr.message);
      }
    }
  } catch (migrationErr) {
    console.error('Error during contacts table columns migration:', migrationErr.message);
  }

  console.log('Database schema initialization completed successfully.');
}

/**
 * Initializes schema and sets up tables inside a new schema for a newly registered company.
 */
async function initializeCompanySchema(regNum, companyName, adminEmail, adminPasswordHash, adminPlainPassword) {
  const schemaName = `company_${regNum}`;
  const client = await pgPool.connect();
  const errorHandler = (err) => { console.error('Database client error in initializeCompanySchema:', err.message); };
  client.on('error', errorHandler);
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}"`);
    
    const serialType = 'SERIAL PRIMARY KEY';
    const textType = 'TEXT';
    const timestampType = 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP';
    const dateType = 'DATE DEFAULT CURRENT_DATE';

    const schemas = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id ${serialType},
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'telecaller',
        status VARCHAR(20) DEFAULT 'offline',
        last_active_at ${timestampType},
        created_at ${timestampType},
        plain_password VARCHAR(255),
        current_token TEXT,
        profile_photo ${textType} DEFAULT NULL
      )`,

      // Campaigns table
      `CREATE TABLE IF NOT EXISTS campaigns (
        id ${serialType},
        name VARCHAR(100) NOT NULL,
        description ${textType},
        status VARCHAR(20) DEFAULT 'pending',
        created_by INTEGER REFERENCES users(id),
        created_at ${timestampType}
      )`,

      // Contacts table
      `CREATE TABLE IF NOT EXISTS contacts (
        id ${serialType},
        campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        last_called_at ${timestampType},
        follow_up_date ${timestampType},
        follow_up_started_at ${timestampType},
        try_count INTEGER DEFAULT 0,
        last_try_date ${dateType},
        response_1 ${textType},
        response_2 ${textType},
        response_3 ${textType},
        created_at ${timestampType}
      )`,

      // Call logs table
      `CREATE TABLE IF NOT EXISTS call_logs (
        id ${serialType},
        contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
        telecaller_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        call_status VARCHAR(20) NOT NULL,
        duration INTEGER DEFAULT 0,
        feedback ${textType},
        recording_url ${textType},
        called_at ${timestampType}
      )`,

      // Lead transfers table
      `CREATE TABLE IF NOT EXISTS lead_transfers (
        id ${serialType},
        contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
        from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(20) DEFAULT 'pending',
        reason ${textType},
        created_at ${timestampType}
      )`,

      // Telecaller sessions table
      `CREATE TABLE IF NOT EXISTS telecaller_sessions (
        id ${serialType},
        telecaller_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date ${dateType},
        total_working_time INTEGER DEFAULT 0,
        total_calling_time INTEGER DEFAULT 0,
        total_idle_time INTEGER DEFAULT 0,
        total_break_time INTEGER DEFAULT 0,
        whatsapp_messages_count INTEGER DEFAULT 0,
        last_updated_at ${timestampType},
        UNIQUE (telecaller_id, date)
      )`,

      // Admin notifications table
      `CREATE TABLE IF NOT EXISTS admin_notifications (
        id ${serialType},
        message ${textType} NOT NULL,
        created_at ${timestampType}
      )`
    ];

    for (const sql of schemas) {
      await client.query(sql);
    }

    console.log(`[Database] Inserting admin user into schema "${schemaName}":`, {
      name: companyName + ' Admin',
      email: adminEmail,
      plainPassword: adminPlainPassword
    });

    const insertRes = await client.query(
      'INSERT INTO users (name, email, password_hash, plain_password, role) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (email) DO NOTHING',
      [companyName + ' Admin', adminEmail, adminPasswordHash, adminPlainPassword, 'admin']
    );

    console.log(`[Database] Insert result: rowCount = ${insertRes.rowCount}`);
    console.log(`[Database] Company PostgreSQL schema "${schemaName}" initialized successfully.`);
  } finally {
    client.removeListener('error', errorHandler);
    client.release();
  }
}

/**
 * Ensures the company database is created and fully provisioned.
 */
async function ensureCompanySchema(regNum, companyName, adminEmail, adminPasswordHash, adminPlainPassword) {
  await initializeCompanySchema(regNum, companyName, adminEmail, adminPasswordHash, adminPlainPassword);
}

/**
 * Helper to fetch the number of telecallers inside a company's database schema.
 */
async function getCompanyTelecallerCount(regNum) {
  const schemaName = `company_${regNum}`;
  const client = await pgPool.connect();
  const errorHandler = (err) => { console.error('Database client error in getCompanyTelecallerCount:', err.message); };
  client.on('error', errorHandler);
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    const res = await client.query("SELECT COUNT(*) as count FROM users WHERE role = 'telecaller'");
    return parseInt(res.rows[0].count) || 0;
  } finally {
    client.removeListener('error', errorHandler);
    client.release();
  }
}

function closeCompanyConnection(regNum) {
  // Deprecated: SQLite only, no-op for Postgres
}

function parseSafeDate(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return dateInput;
  let dateStr = dateInput.toString();
  if (!dateStr.includes('Z') && !dateStr.includes('T')) {
    if (dateStr.includes(' ') && dateStr.includes('-')) {
      dateStr = dateStr.replace(' ', 'T') + 'Z';
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

module.exports = {
  query,
  queryMain,
  initializeSchema,
  initializeCompanySchema,
  ensureCompanySchema,
  getCompanyTelecallerCount,
  closeCompanyConnection,
  getDatabasesDir,
  dbStorage,
  dbType,
  pgPool,
  parseSafeDate,
};
