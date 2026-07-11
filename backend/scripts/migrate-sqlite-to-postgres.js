const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// PostgreSQL Connection
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper to open SQLite DB connection
function openSqlite(filePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

// Helper to run query on SQLite
function sqliteAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Safe wrapper for sqliteAll to handle null database references or query failures
async function safeSqliteAll(db, sql, params = []) {
  if (!db) return [];
  try {
    return await sqliteAll(db, sql, params);
  } catch (err) {
    console.log(`  [Warning] SQLite query error: ${err.message}`);
    return [];
  }
}

// Convert value to boolean for PostgreSQL compatibility
function toBool(val) {
  if (val === null || val === undefined) return false;
  return val === 1 || val === '1' || val === true || val === 'true';
}

// Helper to verify if a table exists in SQLite
async function sqliteTableExists(db, tableName) {
  if (!db) return false;
  try {
    const rows = await sqliteAll(db, "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName]);
    return rows.length > 0;
  } catch (err) {
    return false;
  }
}

// Format date/timestamp values safely
function toDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// Dynamic schema initialization tables (PostgreSQL schema table creators)
const tenantTableSchemas = (schemaName) => [
  `CREATE TABLE IF NOT EXISTS "${schemaName}".users (
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
  )`,
  `CREATE TABLE IF NOT EXISTS "${schemaName}".campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    created_by INTEGER REFERENCES "${schemaName}".users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "${schemaName}".contacts (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES "${schemaName}".campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    assigned_to INTEGER REFERENCES "${schemaName}".users(id) ON DELETE SET NULL,
    added_by INTEGER REFERENCES "${schemaName}".users(id) ON DELETE SET NULL,
    last_called_at TIMESTAMP,
    follow_up_date TIMESTAMP,
    follow_up_started_at TIMESTAMP,
    try_count INTEGER DEFAULT 0,
    last_try_date DATE DEFAULT NULL,
    response_1 TEXT,
    response_2 TEXT,
    response_3 TEXT,
    is_stale BOOLEAN DEFAULT FALSE,
    stale_since TIMESTAMP,
    last_follow_up_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "${schemaName}".call_logs (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES "${schemaName}".contacts(id) ON DELETE CASCADE,
    telecaller_id INTEGER REFERENCES "${schemaName}".users(id) ON DELETE SET NULL,
    call_status VARCHAR(20) NOT NULL,
    duration INTEGER DEFAULT 0,
    feedback TEXT,
    recording_url TEXT,
    called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "${schemaName}".lead_transfers (
    id SERIAL PRIMARY KEY,
    contact_id INTEGER REFERENCES "${schemaName}".contacts(id) ON DELETE CASCADE,
    from_user_id INTEGER REFERENCES "${schemaName}".users(id) ON DELETE SET NULL,
    to_user_id INTEGER REFERENCES "${schemaName}".users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "${schemaName}".telecaller_sessions (
    id SERIAL PRIMARY KEY,
    telecaller_id INTEGER REFERENCES "${schemaName}".users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    total_working_time INTEGER DEFAULT 0,
    total_calling_time INTEGER DEFAULT 0,
    total_idle_time INTEGER DEFAULT 0,
    total_break_time INTEGER DEFAULT 0,
    whatsapp_messages_count INTEGER DEFAULT 0,
    last_updated_at TIMESTAMP,
    UNIQUE (telecaller_id, date)
  )`,
  `CREATE TABLE IF NOT EXISTS "${schemaName}".admin_notifications (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`
];

async function main() {
  console.log('Starting SQLite to PostgreSQL Neon Migration...');
  
  const mainDbPath = path.resolve('database.sqlite');
  console.log(`Master database path: ${mainDbPath}`);
  
  const mainDb = await openSqlite(mainDbPath);
  const pgClient = await pgPool.connect();

  try {
    // ----------------------------------------------------
    // STEP 1: Migrate Master Tables to public schema
    // ----------------------------------------------------
    console.log('\n--- Migrating Master (public) Tables ---');
    
    // Clear master tables in PG to ensure clean migration state
    await pgClient.query(`TRUNCATE TABLE public.companies CASCADE`);

    // 1.1 companies
    const companies = await sqliteAll(mainDb, 'SELECT * FROM companies');
    console.log(`Found ${companies.length} companies to migrate.`);
    
    for (const comp of companies) {
      await pgClient.query(`
        INSERT INTO public.companies (
          id, name, nature, no_of_telecallers, reg_num, admin_email,
          admin_password_hash, admin_plain_password, price_per_telecaller,
          plan_type, subscription_start, subscription_end, edit_count,
          created_at, mac_address, call_recording_enabled, call_recording_end_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          nature = EXCLUDED.nature,
          no_of_telecallers = EXCLUDED.no_of_telecallers,
          reg_num = EXCLUDED.reg_num,
          admin_email = EXCLUDED.admin_email,
          admin_password_hash = EXCLUDED.admin_password_hash,
          admin_plain_password = EXCLUDED.admin_plain_password,
          price_per_telecaller = EXCLUDED.price_per_telecaller,
          plan_type = EXCLUDED.plan_type,
          subscription_start = EXCLUDED.subscription_start,
          subscription_end = EXCLUDED.subscription_end,
          edit_count = EXCLUDED.edit_count,
          mac_address = EXCLUDED.mac_address,
          call_recording_enabled = EXCLUDED.call_recording_enabled,
          call_recording_end_date = EXCLUDED.call_recording_end_date
      `, [
        comp.id, comp.name, comp.nature, comp.no_of_telecallers, comp.reg_num, comp.admin_email,
        comp.admin_password_hash, comp.admin_plain_password, comp.price_per_telecaller,
        comp.plan_type, toDate(comp.subscription_start), toDate(comp.subscription_end), comp.edit_count,
        toDate(comp.created_at), comp.mac_address, comp.call_recording_enabled, toDate(comp.call_recording_end_date)
      ]);
    }
    console.log('public.companies migrated successfully.');

    // 1.2 payments
    const paymentsExist = await sqliteTableExists(mainDb, 'payments');
    if (paymentsExist) {
      const payments = await sqliteAll(mainDb, 'SELECT * FROM payments');
      console.log(`Found ${payments.length} payments to migrate.`);
      for (const pay of payments) {
        await pgClient.query(`
          INSERT INTO public.payments (
            id, company_reg_num, razorpay_order_id, razorpay_payment_id,
            razorpay_signature, amount, plan_type, no_of_telecallers,
            call_recording, status, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            company_reg_num = EXCLUDED.company_reg_num,
            razorpay_order_id = EXCLUDED.razorpay_order_id,
            razorpay_payment_id = EXCLUDED.razorpay_payment_id,
            razorpay_signature = EXCLUDED.razorpay_signature,
            amount = EXCLUDED.amount,
            plan_type = EXCLUDED.plan_type,
            no_of_telecallers = EXCLUDED.no_of_telecallers,
            call_recording = EXCLUDED.call_recording,
            status = EXCLUDED.status
        `, [
          pay.id, pay.company_reg_num, pay.razorpay_order_id, pay.razorpay_payment_id,
          pay.razorpay_signature, pay.amount, pay.plan_type, pay.no_of_telecallers,
          toBool(pay.call_recording), pay.status, toDate(pay.created_at)
        ]);
      }
      console.log('public.payments migrated successfully.');
    } else {
      console.log('payments table not found in SQLite. Skipping.');
    }

    // 1.3 support_tickets
    const ticketsExist = await sqliteTableExists(mainDb, 'support_tickets');
    if (ticketsExist) {
      const tickets = await sqliteAll(mainDb, 'SELECT * FROM support_tickets');
      console.log(`Found ${tickets.length} support tickets to migrate.`);
      for (const tick of tickets) {
        await pgClient.query(`
          INSERT INTO public.support_tickets (
            id, company_reg_num, company_name, admin_email, subject,
            message, status, created_at, resolved_at, image_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            company_reg_num = EXCLUDED.company_reg_num,
            company_name = EXCLUDED.company_name,
            admin_email = EXCLUDED.admin_email,
            subject = EXCLUDED.subject,
            message = EXCLUDED.message,
            status = EXCLUDED.status,
            resolved_at = EXCLUDED.resolved_at,
            image_url = EXCLUDED.image_url
        `, [
          tick.id, tick.company_reg_num, tick.company_name, tick.admin_email, tick.subject,
          tick.message, tick.status, toDate(tick.created_at), toDate(tick.resolved_at), tick.image_url
        ]);
      }
      console.log('public.support_tickets migrated successfully.');
    } else {
      console.log('support_tickets table not found in SQLite. Skipping.');
    }

    // 1.4 password_resets
    const resetsExist = await sqliteTableExists(mainDb, 'password_resets');
    if (resetsExist) {
      const resets = await sqliteAll(mainDb, 'SELECT * FROM password_resets');
      console.log(`Found ${resets.length} password resets to migrate.`);
      for (const res of resets) {
        await pgClient.query(`
          INSERT INTO public.password_resets (
            id, email, otp, expires_at, created_at
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            otp = EXCLUDED.otp,
            expires_at = EXCLUDED.expires_at
        `, [
          res.id, res.email, res.otp, toDate(res.expires_at), toDate(res.created_at)
        ]);
      }
      console.log('public.password_resets migrated successfully.');
    } else {
      console.log('password_resets table not found in SQLite. Skipping.');
    }


    // ----------------------------------------------------
    // STEP 2: Migrate Tenant-Specific Schemas
    // ----------------------------------------------------
    console.log('\n--- Migrating Tenant Schemas ---');
    
    for (const comp of companies) {
      const regNum = comp.reg_num;
      const schemaName = `company_${regNum}`;
      console.log(`\nProcessing Company: ${comp.name} (${regNum}) -> Schema: ${schemaName}`);

      // Strip EAZ- prefix to resolve exact filename (e.g. company_552057.sqlite)
      const numericRegNum = regNum.replace('EAZ-', '');
      const dynamicDbFile = path.resolve(`databases/company_${numericRegNum}.sqlite`);
      let tenantDb = null;
      let isUsingGlobalDb = false;

      if (fs.existsSync(dynamicDbFile)) {
        console.log(`  Found company SQLite file: ${dynamicDbFile}`);
        tenantDb = await openSqlite(dynamicDbFile);
      } else if (regNum === 'EAZ-397728') {
        console.log(`  Dynamic SQLite file NOT found for TATA STEEL (EAZ-397728). Using legacy global database fallback.`);
        tenantDb = mainDb;
        isUsingGlobalDb = true;
      } else {
        console.log(`  Dynamic SQLite file NOT found for ${regNum}. This is an empty tenant schema (No legacy SQLite data).`);
        tenantDb = null;
      }

      // Create PG schema & tables
      await pgClient.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      const createTableSqls = tenantTableSchemas(schemaName);
      for (const sql of createTableSqls) {
        await pgClient.query(sql);
      }
      console.log(`  PostgreSQL schema and tables verified/created for "${schemaName}".`);

      // Run dynamic alters to guarantee all schema/table discrepancies are resolved
      try { await pgClient.query(`ALTER TABLE "${schemaName}".users ADD COLUMN IF NOT EXISTS profile_photo TEXT DEFAULT NULL`); } catch (_) {}
      try { await pgClient.query(`ALTER TABLE "${schemaName}".users ADD COLUMN IF NOT EXISTS plain_password VARCHAR(255)`); } catch (_) {}
      try { await pgClient.query(`ALTER TABLE "${schemaName}".users ADD COLUMN IF NOT EXISTS current_token TEXT`); } catch (_) {}

      try { await pgClient.query(`ALTER TABLE "${schemaName}".contacts ADD COLUMN IF NOT EXISTS follow_up_started_at TIMESTAMP`); } catch (_) {}
      try { await pgClient.query(`ALTER TABLE "${schemaName}".contacts ADD COLUMN IF NOT EXISTS try_count INTEGER DEFAULT 0`); } catch (_) {}
      try { await pgClient.query(`ALTER TABLE "${schemaName}".contacts ADD COLUMN IF NOT EXISTS last_try_date DATE DEFAULT NULL`); } catch (_) {}
      try { await pgClient.query(`ALTER TABLE "${schemaName}".contacts ADD COLUMN IF NOT EXISTS response_1 TEXT DEFAULT NULL`); } catch (_) {}
      try { await pgClient.query(`ALTER TABLE "${schemaName}".contacts ADD COLUMN IF NOT EXISTS response_2 TEXT DEFAULT NULL`); } catch (_) {}
      try { await pgClient.query(`ALTER TABLE "${schemaName}".contacts ADD COLUMN IF NOT EXISTS response_3 TEXT DEFAULT NULL`); } catch (_) {}
      try { await pgClient.query(`ALTER TABLE "${schemaName}".contacts ADD COLUMN IF NOT EXISTS is_stale BOOLEAN DEFAULT FALSE`); } catch (_) {}
      try { await pgClient.query(`ALTER TABLE "${schemaName}".contacts ADD COLUMN IF NOT EXISTS stale_since TIMESTAMP`); } catch (_) {}
      try { await pgClient.query(`ALTER TABLE "${schemaName}".contacts ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMP`); } catch (_) {}
      try { await pgClient.query(`ALTER TABLE "${schemaName}".contacts ADD COLUMN IF NOT EXISTS added_by INTEGER`); } catch (_) {}

      try { await pgClient.query(`ALTER TABLE "${schemaName}".telecaller_sessions ADD COLUMN IF NOT EXISTS whatsapp_messages_count INTEGER DEFAULT 0`); } catch (_) {}

      // Clear existing records in PG to ensure clean migration state
      await pgClient.query(`TRUNCATE TABLE "${schemaName}".admin_notifications, "${schemaName}".telecaller_sessions, "${schemaName}".lead_transfers, "${schemaName}".call_logs, "${schemaName}".contacts, "${schemaName}".campaigns, "${schemaName}".users CASCADE`);

      // 2.1 users
      const users = await safeSqliteAll(tenantDb, 'SELECT * FROM users');
      console.log(`  Found ${users.length} users in source.`);
      for (const u of users) {
        await pgClient.query(`
          INSERT INTO "${schemaName}".users (
            id, name, email, password_hash, role, status, last_active_at,
            created_at, plain_password, current_token, profile_photo
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            status = EXCLUDED.status,
            last_active_at = EXCLUDED.last_active_at,
            plain_password = EXCLUDED.plain_password,
            current_token = EXCLUDED.current_token,
            profile_photo = EXCLUDED.profile_photo
        `, [
          u.id, u.name, u.email, u.password_hash, u.role, u.status, toDate(u.last_active_at),
          toDate(u.created_at), u.plain_password, u.current_token, u.profile_photo
        ]);
      }

      // Fallback: Ensure Company Admin User exists in users table
      const hasAdmin = users.some(u => u.email === comp.admin_email);
      let adminId = null;
      if (!hasAdmin) {
        console.log(`  Creating company admin "${comp.admin_email}" inside "${schemaName}".users.`);
        adminId = Math.max(...users.map(u => u.id), 0) + 1;
        await pgClient.query(`
          INSERT INTO "${schemaName}".users (
            id, name, email, password_hash, plain_password, role
          ) VALUES ($1, $2, $3, $4, $5, 'admin')
          ON CONFLICT (email) DO NOTHING
        `, [adminId, comp.name + ' Admin', comp.admin_email, comp.admin_password_hash, comp.admin_plain_password]);
      }

      const userIdsSet = new Set(users.map(u => u.id));
      if (adminId !== null) {
        userIdsSet.add(adminId);
      }

      // 2.2 campaigns
      const campaigns = await safeSqliteAll(tenantDb, 'SELECT * FROM campaigns');
      console.log(`  Found ${campaigns.length} campaigns in source.`);
      const campaignIdsSet = new Set();
      for (const c of campaigns) {
        let createdBy = c.created_by;
        if (createdBy !== null && !userIdsSet.has(createdBy)) {
          console.log(`  [Warning] Campaign ID ${c.id} created_by ${createdBy} not found in users. Setting to null.`);
          createdBy = null;
        }
        await pgClient.query(`
          INSERT INTO "${schemaName}".campaigns (
            id, name, description, status, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            created_by = EXCLUDED.created_by
        `, [
          c.id, c.name, c.description, c.status, createdBy, toDate(c.created_at)
        ]);
        campaignIdsSet.add(c.id);
      }

      // 2.3 contacts
      const contacts = await safeSqliteAll(tenantDb, 'SELECT * FROM contacts');
      console.log(`  Found ${contacts.length} contacts in source.`);
      const contactIdsSet = new Set();
      for (const c of contacts) {
        let campaignId = c.campaign_id;
        if (campaignId !== null && !campaignIdsSet.has(campaignId)) {
          console.log(`  [Warning] Contact ID ${c.id} campaign_id ${campaignId} not found in campaigns. Setting to null.`);
          campaignId = null;
        }
        let assignedTo = c.assigned_to;
        if (assignedTo !== null && !userIdsSet.has(assignedTo)) {
          console.log(`  [Warning] Contact ID ${c.id} assigned_to ${assignedTo} not found in users. Setting to null.`);
          assignedTo = null;
        }
        let addedBy = c.added_by;
        if (addedBy !== null && !userIdsSet.has(addedBy)) {
          console.log(`  [Warning] Contact ID ${c.id} added_by ${addedBy} not found in users. Setting to null.`);
          addedBy = null;
        }
        await pgClient.query(`
          INSERT INTO "${schemaName}".contacts (
            id, campaign_id, name, phone_number, status, assigned_to, added_by,
            last_called_at, follow_up_date, follow_up_started_at, try_count,
            last_try_date, response_1, response_2, response_3, is_stale,
            stale_since, last_follow_up_at, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
          ) ON CONFLICT (id) DO UPDATE SET
            campaign_id = EXCLUDED.campaign_id,
            name = EXCLUDED.name,
            phone_number = EXCLUDED.phone_number,
            status = EXCLUDED.status,
            assigned_to = EXCLUDED.assigned_to,
            added_by = EXCLUDED.added_by,
            last_called_at = EXCLUDED.last_called_at,
            follow_up_date = EXCLUDED.follow_up_date,
            follow_up_started_at = EXCLUDED.follow_up_started_at,
            try_count = EXCLUDED.try_count,
            last_try_date = EXCLUDED.last_try_date,
            response_1 = EXCLUDED.response_1,
            response_2 = EXCLUDED.response_2,
            response_3 = EXCLUDED.response_3,
            is_stale = EXCLUDED.is_stale,
            stale_since = EXCLUDED.stale_since,
            last_follow_up_at = EXCLUDED.last_follow_up_at
        `, [
          c.id, campaignId, c.name, c.phone_number, c.status, assignedTo, addedBy,
          toDate(c.last_called_at), toDate(c.follow_up_date), toDate(c.follow_up_started_at), c.try_count,
          c.last_try_date ? new Date(c.last_try_date) : null, c.response_1, c.response_2, c.response_3, toBool(c.is_stale),
          toDate(c.stale_since), toDate(c.last_follow_up_at), toDate(c.created_at)
        ]);
        contactIdsSet.add(c.id);
      }

      // 2.4 call_logs
      const callLogs = await safeSqliteAll(tenantDb, 'SELECT * FROM call_logs');
      console.log(`  Found ${callLogs.length} call logs in source.`);
      for (const log of callLogs) {
        let contactId = log.contact_id;
        if (contactId !== null && !contactIdsSet.has(contactId)) {
          console.log(`  [Warning] Call log ID ${log.id} contact_id ${contactId} not found in contacts. Setting to null.`);
          contactId = null;
        }
        let telecallerId = log.telecaller_id;
        if (telecallerId !== null && !userIdsSet.has(telecallerId)) {
          console.log(`  [Warning] Call log ID ${log.id} telecaller_id ${telecallerId} not found in users. Setting to null.`);
          telecallerId = null;
        }
        await pgClient.query(`
          INSERT INTO "${schemaName}".call_logs (
            id, contact_id, telecaller_id, call_status, duration, feedback,
            recording_url, called_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            contact_id = EXCLUDED.contact_id,
            telecaller_id = EXCLUDED.telecaller_id,
            call_status = EXCLUDED.call_status,
            duration = EXCLUDED.duration,
            feedback = EXCLUDED.feedback,
            recording_url = EXCLUDED.recording_url
        `, [
          log.id, contactId, telecallerId, log.call_status, log.duration, log.feedback,
          log.recording_url, toDate(log.called_at)
        ]);
      }

      // 2.5 lead_transfers
      const leadTransfers = await safeSqliteAll(tenantDb, 'SELECT * FROM lead_transfers');
      console.log(`  Found ${leadTransfers.length} lead transfers in source.`);
      for (const lt of leadTransfers) {
        let contactId = lt.contact_id;
        if (contactId !== null && !contactIdsSet.has(contactId)) {
          console.log(`  [Warning] Lead transfer ID ${lt.id} contact_id ${contactId} not found in contacts. Setting to null.`);
          contactId = null;
        }
        let fromUserId = lt.from_user_id;
        if (fromUserId !== null && !userIdsSet.has(fromUserId)) {
          console.log(`  [Warning] Lead transfer ID ${lt.id} from_user_id ${fromUserId} not found in users. Setting to null.`);
          fromUserId = null;
        }
        let toUserId = lt.to_user_id;
        if (toUserId !== null && !userIdsSet.has(toUserId)) {
          console.log(`  [Warning] Lead transfer ID ${lt.id} to_user_id ${toUserId} not found in users. Setting to null.`);
          toUserId = null;
        }
        await pgClient.query(`
          INSERT INTO "${schemaName}".lead_transfers (
            id, contact_id, from_user_id, to_user_id, status, reason, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            contact_id = EXCLUDED.contact_id,
            from_user_id = EXCLUDED.from_user_id,
            to_user_id = EXCLUDED.to_user_id,
            status = EXCLUDED.status,
            reason = EXCLUDED.reason
        `, [
          lt.id, contactId, fromUserId, toUserId, lt.status, lt.reason, toDate(lt.created_at)
        ]);
      }

      // 2.6 telecaller_sessions
      const sessions = await safeSqliteAll(tenantDb, 'SELECT * FROM telecaller_sessions');
      console.log(`  Found ${sessions.length} sessions in source.`);
      for (const s of sessions) {
        let telecallerId = s.telecaller_id;
        if (!userIdsSet.has(telecallerId)) {
          console.log(`  [Warning] Session ID ${s.id} telecaller_id ${telecallerId} not found in users. Skipping session record.`);
          continue;
        }
        await pgClient.query(`
          INSERT INTO "${schemaName}".telecaller_sessions (
            id, telecaller_id, date, total_working_time, total_calling_time,
            total_idle_time, total_break_time, whatsapp_messages_count, last_updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (telecaller_id, date) DO UPDATE SET
            total_working_time = EXCLUDED.total_working_time,
            total_calling_time = EXCLUDED.total_calling_time,
            total_idle_time = EXCLUDED.total_idle_time,
            total_break_time = EXCLUDED.total_break_time,
            whatsapp_messages_count = EXCLUDED.whatsapp_messages_count,
            last_updated_at = EXCLUDED.last_updated_at
        `, [
          s.id, telecallerId, s.date ? new Date(s.date) : null, s.total_working_time, s.total_calling_time,
          s.total_idle_time, s.total_break_time, s.whatsapp_messages_count || 0, toDate(s.last_updated_at)
        ]);
      }

      // 2.7 admin_notifications
      const notes = await safeSqliteAll(tenantDb, 'SELECT * FROM admin_notifications');
      console.log(`  Found ${notes.length} admin notifications in source.`);
      for (const n of notes) {
        await pgClient.query(`
          INSERT INTO "${schemaName}".admin_notifications (
            id, message, created_at
          ) VALUES ($1, $2, $3)
          ON CONFLICT (id) DO UPDATE SET
            message = EXCLUDED.message
        `, [
          n.id, n.message, toDate(n.created_at)
        ]);
      }

      // Close dynamic DB connection if opened
      if (tenantDb && tenantDb !== mainDb) {
        tenantDb.close();
      }
    }


    // ----------------------------------------------------
    // STEP 3: Reset Auto-Increment Sequences
    // ----------------------------------------------------
    console.log('\n--- Resetting PostgreSQL Auto-increment Sequences ---');
    
    // Reset public schema sequences
    const publicTables = ['companies', 'payments', 'support_tickets', 'password_resets'];
    for (const table of publicTables) {
      await pgClient.query(`
        SELECT setval(pg_get_serial_sequence('public."${table}"', 'id'), COALESCE((SELECT MAX(id) FROM public."${table}"), 1), false);
      `);
      console.log(`  Reset sequence for public."${table}"`);
    }

    // Reset tenant schema sequences
    const tenantTables = ['users', 'campaigns', 'contacts', 'call_logs', 'lead_transfers', 'telecaller_sessions', 'admin_notifications'];
    for (const comp of companies) {
      const schemaName = `company_${comp.reg_num}`;
      for (const table of tenantTables) {
        await pgClient.query(`
          SELECT setval(pg_get_serial_sequence('"${schemaName}"."${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${schemaName}"."${table}"), 1), false);
        `);
      }
      console.log(`  Reset sequences for all tables in schema "${schemaName}"`);
    }


    // ----------------------------------------------------
    // STEP 4: Verification Row-Count Assertions
    // ----------------------------------------------------
    console.log('\n--- Database Parity Verification Report ---');
    
    // public tables
    for (const table of publicTables) {
      const exists = await sqliteTableExists(mainDb, table);
      const sqliteCount = exists ? (await sqliteAll(mainDb, `SELECT COUNT(*) as count FROM "${table}"`))[0].count : 0;
      const pgCount = parseInt((await pgClient.query(`SELECT COUNT(*) FROM public."${table}"`)).rows[0].count);
      const status = sqliteCount === pgCount ? 'PASS' : 'FAIL';
      console.log(`[VERIFY] public."${table}" -> SQLite: ${sqliteCount} | Postgres: ${pgCount} [${status}]`);
      if (status === 'FAIL') throw new Error(`Row count mismatch on master table public."${table}"`);
    }

    // tenant tables
    for (const comp of companies) {
      const regNum = comp.reg_num;
      const schemaName = `company_${regNum}`;
      
      const numericRegNum = regNum.replace('EAZ-', '');
      const dynamicDbFile = path.resolve(`databases/company_${numericRegNum}.sqlite`);
      let sourceDb = null;
      if (fs.existsSync(dynamicDbFile)) {
        sourceDb = await openSqlite(dynamicDbFile);
      } else if (regNum === 'EAZ-397728') {
        sourceDb = mainDb;
      }

      console.log(`\nVerifying row counts for schema "${schemaName}":`);
      for (const table of tenantTables) {
        let sqliteCount = 0;
        if (sourceDb) {
          try {
            sqliteCount = (await sqliteAll(sourceDb, `SELECT COUNT(*) as count FROM "${table}"`))[0].count;
          } catch (_) {}
        }

        const pgCount = parseInt((await pgClient.query(`SELECT COUNT(*) FROM "${schemaName}"."${table}"`)).rows[0].count);
        
        let status = 'PASS';
        if (table === 'users') {
          let sourceHasAdmin = false;
          if (sourceDb) {
            try {
              const res = await sqliteAll(sourceDb, "SELECT COUNT(*) as count FROM users WHERE email = ?", [comp.admin_email]);
              sourceHasAdmin = res[0].count > 0;
            } catch (_) {}
          }
          const expectedPgCount = sourceHasAdmin ? sqliteCount : sqliteCount + 1;
          if (pgCount === expectedPgCount) {
            status = sourceHasAdmin ? 'PASS' : 'PASS (Fallback Admin User Added)';
          } else {
            status = 'FAIL';
          }
        } else if (sqliteCount !== pgCount) {
          status = 'FAIL';
        }

        console.log(`  "${table}" -> SQLite: ${sqliteCount} | Postgres: ${pgCount} [${status}]`);
        if (status === 'FAIL') throw new Error(`Row count mismatch on tenant table "${schemaName}"."${table}"`);
      }

      if (sourceDb && sourceDb !== mainDb) {
        sourceDb.close();
      }
    }

    console.log('\nAll database verification tests PASSED! Data parity verified successfully.');

  } catch (err) {
    console.error('\nMigration failed with error:', err.message);
    process.exit(1);
  } finally {
    mainDb.close();
    pgClient.release();
    await pgPool.end();
    console.log('Database connections closed.');
  }
}

main();
