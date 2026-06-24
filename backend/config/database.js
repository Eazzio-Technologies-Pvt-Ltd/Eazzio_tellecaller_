const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { AsyncLocalStorage } = require('async_hooks');
require('dotenv').config();

const dbType = process.env.DB_TYPE || 'sqlite';
let pgPool = null;
let sqliteDb = null;

// AsyncLocalStorage to hold company registration code context
const dbStorage = new AsyncLocalStorage();

// Cache for company-specific SQLite database connections
const companyConnections = {};

// Helper to get active database connection based on AsyncLocalStorage context
function getActiveDb() {
  const store = dbStorage.getStore();
  if (store && store.companyRegNum && dbType === 'sqlite') {
    const regNum = store.companyRegNum;
    if (!companyConnections[regNum]) {
      const sqliteFile = path.join(__dirname, '..', 'databases', `company_${regNum}.sqlite`);
      const dir = path.dirname(sqliteFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      companyConnections[regNum] = new sqlite3.Database(sqliteFile);
      console.log(`[Database] Opened connection to company database: company_${regNum}.sqlite`);
    }
    return companyConnections[regNum];
  }
  return sqliteDb;
}

// Promise wrappers for SQLite taking the connection explicitly
const sqliteRun = (dbConn, sql, params = []) => {
  return new Promise((resolve, reject) => {
    dbConn.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ rows: [], lastID: this.lastID, changes: this.changes });
    });
  });
};

const sqliteAll = (dbConn, sql, params = []) => {
  return new Promise((resolve, reject) => {
    dbConn.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve({ rows });
    });
  });
};

if (dbType === 'postgres') {
  console.log('Database Config: Using PostgreSQL');
  pgPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
} else {
  console.log('Database Config: Using SQLite');
  const sqliteFile = path.resolve(process.env.SQLITE_FILE || path.join(__dirname, '..', 'database.sqlite'));
  // Ensure directory exists
  const dir = path.dirname(sqliteFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  sqliteDb = new sqlite3.Database(sqliteFile);
}

/**
 * Executes a query with arguments on the tenant database (resolved dynamically).
 * Uses PostgreSQL ($1, $2) parameter syntax.
 * Automatically translates parameters to SQLite syntax (?) if needed.
 */
async function query(text, params = []) {
  if (dbType === 'postgres') {
    return await pgPool.query(text, params);
  } else {
    const dbConn = getActiveDb();
    // Translate $1, $2 -> ? for SQLite
    const sqliteText = text.replace(/\$\d+/g, '?');
    
    // Determine whether to use run or all
    const cleanText = sqliteText.trim().toLowerCase();
    const isSelect = cleanText.startsWith('select') || cleanText.startsWith('with') || cleanText.includes('returning');
    
    if (isSelect) {
      return await sqliteAll(dbConn, sqliteText, params);
    } else {
      return await sqliteRun(dbConn, sqliteText, params);
    }
  }
}

/**
 * Executes a query specifically on the main database (bypassing tenant routing).
 */
async function queryMain(text, params = []) {
  if (dbType === 'postgres') {
    return await pgPool.query(text, params);
  } else {
    // Translate $1, $2 -> ? for SQLite
    const sqliteText = text.replace(/\$\d+/g, '?');
    const cleanText = sqliteText.trim().toLowerCase();
    const isSelect = cleanText.startsWith('select') || cleanText.startsWith('with') || cleanText.includes('returning');
    
    if (isSelect) {
      return await sqliteAll(sqliteDb, sqliteText, params);
    } else {
      return await sqliteRun(sqliteDb, sqliteText, params);
    }
  }
}

/**
 * Sets up database tables if they do not exist.
 */
async function initializeSchema() {
  console.log('Initializing database schema...');

  const isPg = dbType === 'postgres';
  const serialType = isPg ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const textType = isPg ? 'TEXT' : 'TEXT';
  const timestampType = isPg ? 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' : 'DATETIME DEFAULT CURRENT_TIMESTAMP';
  const currentTimestamp = isPg ? 'CURRENT_TIMESTAMP' : "datetime('now')";
  const dateType = isPg ? 'DATE DEFAULT CURRENT_DATE' : "DATE DEFAULT (date('now'))";

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
      price_per_telecaller INTEGER DEFAULT 49,
      plan_type VARCHAR(20) DEFAULT 'monthly',
      subscription_start ${timestampType},
      subscription_end ${timestampType},
      edit_count INTEGER DEFAULT 0,
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
      created_at ${timestampType}
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
      name VARCHAR(100) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      last_called_at ${timestampType},
      follow_up_date ${timestampType},
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
      last_updated_at ${timestampType}
    )`,

    // Admin notifications table
    `CREATE TABLE IF NOT EXISTS admin_notifications (
      id ${serialType},
      message ${textType} NOT NULL,
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
    await queryMain('ALTER TABLE companies ADD COLUMN subscription_start DATETIME');
    console.log('Added subscription_start column to companies table.');
  } catch (err) { /* already exists */ }
  try {
    await queryMain('ALTER TABLE companies ADD COLUMN subscription_end DATETIME');
    console.log('Added subscription_end column to companies table.');
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

  console.log('Database schema initialization completed successfully.');
}

/**
 * Initializes schema and sets up tables inside a new SQLite file for a newly registered company.
 */
async function initializeCompanySchema(regNum, companyName, adminEmail, adminPasswordHash, adminPlainPassword) {
  const sqliteFile = path.join(__dirname, '..', 'databases', `company_${regNum}.sqlite`);
  const dir = path.dirname(sqliteFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const compDb = new sqlite3.Database(sqliteFile);

  const serialType = 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const textType = 'TEXT';
  const timestampType = 'DATETIME DEFAULT CURRENT_TIMESTAMP';
  const dateType = "DATE DEFAULT (date('now'))";

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
      plain_password VARCHAR(255)
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
      name VARCHAR(100) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      last_called_at ${timestampType},
      follow_up_date ${timestampType},
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
      last_updated_at ${timestampType}
    )`,

    // Admin notifications table
    `CREATE TABLE IF NOT EXISTS admin_notifications (
      id ${serialType},
      message ${textType} NOT NULL,
      created_at ${timestampType}
    )`
  ];

  const runSql = (dbConn, sql, params = []) => {
    return new Promise((resolve, reject) => {
      dbConn.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  for (const sql of schemas) {
    await runSql(compDb, sql);
  }

  // Create default admin user in the company database
  await runSql(
    compDb,
    'INSERT OR IGNORE INTO users (name, email, password_hash, plain_password, role) VALUES (?, ?, ?, ?, ?)',
    [companyName + ' Admin', adminEmail, adminPasswordHash, adminPlainPassword, 'admin']
  );

  await new Promise((resolve) => compDb.close(resolve));
  console.log(`[Database] Company database schema initialized successfully for: ${regNum}`);
}

/**
 * Helper to fetch the number of telecallers inside a company's SQLite database file.
 */
async function getCompanyTelecallerCount(regNum) {
  const sqliteFile = path.join(__dirname, '..', 'databases', `company_${regNum}.sqlite`);
  if (!fs.existsSync(sqliteFile)) return 0;
  
  return new Promise((resolve) => {
    const compDb = new sqlite3.Database(sqliteFile, sqlite3.OPEN_READONLY, (err) => {
      if (err) return resolve(0);
      compDb.get("SELECT COUNT(*) as count FROM users WHERE role = 'telecaller'", (err, row) => {
        compDb.close();
        if (err || !row) return resolve(0);
        resolve(row.count);
      });
    });
  });
}

function closeCompanyConnection(regNum) {
  if (companyConnections[regNum]) {
    try {
      companyConnections[regNum].close();
      delete companyConnections[regNum];
      console.log(`[Database] Closed cached connection for ${regNum}`);
    } catch (err) {
      console.error(`Error closing database for ${regNum}:`, err);
    }
  }
}

module.exports = {
  query,
  queryMain,
  initializeSchema,
  initializeCompanySchema,
  getCompanyTelecallerCount,
  closeCompanyConnection,
  dbStorage,
  dbType,
};
