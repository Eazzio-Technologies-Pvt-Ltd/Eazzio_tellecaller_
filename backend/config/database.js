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

// Helper to resolve company-specific databases directory (dynamic persistent storage support)
function getDatabasesDir() {
  const baseDir = process.env.SQLITE_FILE 
    ? path.dirname(path.resolve(process.env.SQLITE_FILE)) 
    : path.join(__dirname, '..');
  return path.join(baseDir, 'databases');
}

// Helper to get active database connection based on AsyncLocalStorage context
function getActiveDb() {
  const store = dbStorage.getStore();
  if (store && store.companyRegNum && dbType === 'sqlite') {
    const regNum = store.companyRegNum;
    if (!companyConnections[regNum]) {
      const sqliteFile = path.join(getDatabasesDir(), `company_${regNum}.sqlite`);
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
    const store = dbStorage.getStore();
    if (store && store.companyRegNum) {
      const schemaName = `company_${store.companyRegNum}`;
      const client = await pgPool.connect();
      try {
        await client.query(`SET search_path TO "${schemaName}", "public"`);
        return await client.query(text, params);
      } finally {
        client.release();
      }
    }
    return await pgPool.query(text, params);
  } else {
    const dbConn = getActiveDb();
    // Translate $1, $2 -> ? for SQLite with parameter replication
    const matches = text.match(/\$\d+/g);
    let sqliteText = text;
    let sqliteParams = params;
    if (matches) {
      sqliteParams = [];
      sqliteText = text.replace(/\$\d+/g, (match) => {
        const index = parseInt(match.substring(1), 10) - 1;
        sqliteParams.push(params[index]);
        return '?';
      });
    }
    
    // Determine whether to use run or all
    const cleanText = sqliteText.trim().toLowerCase();
    const isSelect = cleanText.startsWith('select') || cleanText.startsWith('with') || cleanText.includes('returning');
    
    if (isSelect) {
      return await sqliteAll(dbConn, sqliteText, sqliteParams);
    } else {
      return await sqliteRun(dbConn, sqliteText, sqliteParams);
    }
  }
}

/**
 * Executes a query specifically on the main database (bypassing tenant routing).
 */
async function queryMain(text, params = []) {
  if (dbType === 'postgres') {
    const client = await pgPool.connect();
    try {
      await client.query('SET search_path TO "public"');
      return await client.query(text, params);
    } finally {
      client.release();
    }
  } else {
    // Translate $1, $2 -> ? for SQLite with parameter replication
    const matches = text.match(/\$\d+/g);
    let sqliteText = text;
    let sqliteParams = params;
    if (matches) {
      sqliteParams = [];
      sqliteText = text.replace(/\$\d+/g, (match) => {
        const index = parseInt(match.substring(1), 10) - 1;
        sqliteParams.push(params[index]);
        return '?';
      });
    }
    const cleanText = sqliteText.trim().toLowerCase();
    const isSelect = cleanText.startsWith('select') || cleanText.startsWith('with') || cleanText.includes('returning');
    
    if (isSelect) {
      return await sqliteAll(sqliteDb, sqliteText, sqliteParams);
    } else {
      return await sqliteRun(sqliteDb, sqliteText, sqliteParams);
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
      mac_address VARCHAR(255),
      call_recording_enabled INTEGER DEFAULT 0,
      call_recording_end_date ${timestampType},
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
      name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(50) NOT NULL,
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
      expires_at ${isPg ? 'TIMESTAMP' : 'DATETIME'} NOT NULL,
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

  // Migrate all dynamic company databases to add current_token column (SQLite only)
  try {
    const databasesDir = getDatabasesDir();
    if (dbType === 'sqlite' && fs.existsSync(databasesDir)) {
      const files = fs.readdirSync(databasesDir);
      for (const file of files) {
        if (file.startsWith('company_') && file.endsWith('.sqlite')) {
          const sqliteFile = path.join(databasesDir, file);
          const compDb = new sqlite3.Database(sqliteFile);
          await new Promise((resolve) => {
            compDb.run('ALTER TABLE users ADD COLUMN current_token TEXT', [], (err) => {
              compDb.close();
              resolve();
            });
          });
          console.log(`Migrated company database ${file} to add current_token.`);
        }
      }
    }
  } catch (err) {
    console.error('Error migrating dynamic company databases:', err);
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
  try {
    await queryMain('ALTER TABLE companies ADD COLUMN mac_address VARCHAR(255)');
    console.log('Added mac_address column to companies table.');
  } catch (err) { /* already exists */ }
  try {
    await queryMain('ALTER TABLE companies ADD COLUMN call_recording_enabled INTEGER DEFAULT 0');
    console.log('Added call_recording_enabled column to companies table.');
  } catch (err) { /* already exists */ }
  try {
    const tsType = dbType === 'postgres' ? 'TIMESTAMP' : 'DATETIME';
    await queryMain(`ALTER TABLE companies ADD COLUMN call_recording_end_date ${tsType}`);
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
    if (dbType === 'postgres') {
      // 1. Alter public database contacts table
      await queryMain('ALTER TABLE contacts ALTER COLUMN phone_number TYPE VARCHAR(50)');
      await queryMain('ALTER TABLE contacts ALTER COLUMN name TYPE VARCHAR(255)');
      console.log('Migrated public contacts table column types to VARCHAR(50) and VARCHAR(255).');

      // 2. Alter dynamic schemas
      const companiesRes = await queryMain('SELECT reg_num FROM companies');
      for (const row of companiesRes.rows) {
        const schemaName = `company_${row.reg_num}`;
        try {
          const client = await pgPool.connect();
          try {
            await client.query(`SET search_path TO "${schemaName}"`);
            await client.query('ALTER TABLE contacts ALTER COLUMN phone_number TYPE VARCHAR(50)');
            await client.query('ALTER TABLE contacts ALTER COLUMN name TYPE VARCHAR(255)');
            console.log(`Migrated contacts table column types to VARCHAR(50) and VARCHAR(255) in schema: ${schemaName}`);
          } finally {
            client.release();
          }
        } catch (schemaErr) {
          console.error(`Failed to migrate schema ${schemaName}:`, schemaErr.message);
        }
      }
    }
  } catch (migrationErr) {
    console.error('Error during contacts table columns migration:', migrationErr.message);
  }

  console.log('Database schema initialization completed successfully.');
}

/**
 * Initializes schema and sets up tables inside a new SQLite file for a newly registered company.
 */
async function initializeCompanySchema(regNum, companyName, adminEmail, adminPasswordHash, adminPlainPassword) {
  if (dbType === 'postgres') {
    const schemaName = `company_${regNum}`;
    const client = await pgPool.connect();
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
          current_token TEXT
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
      client.release();
    }
    return;
  }

  const sqliteFile = path.join(getDatabasesDir(), `company_${regNum}.sqlite`);
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
      plain_password VARCHAR(255),
      current_token TEXT
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
 * Ensures the company database is created and fully provisioned.
 * Automatically runs dynamic schema creation if database exists but has no tables.
 */
async function ensureCompanySchema(regNum, companyName, adminEmail, adminPasswordHash, adminPlainPassword) {
  if (dbType === 'sqlite') {
    const sqliteFile = path.join(getDatabasesDir(), `company_${regNum}.sqlite`);
    let needsInit = !fs.existsSync(sqliteFile);
    if (!needsInit) {
      const tables = await new Promise((resolve) => {
        const compDb = new sqlite3.Database(sqliteFile, sqlite3.OPEN_READONLY, (err) => {
          if (err) return resolve([]);
          compDb.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, rows) => {
            compDb.close();
            if (err || !rows) return resolve([]);
            resolve(rows);
          });
        });
      });
      if (tables.length === 0) {
        needsInit = true;
      }
    }

    if (needsInit) {
      console.log(`[Database] Auto-initializing missing SQLite schema for company ${regNum}...`);
      // Close active cached connection if it exists to avoid locking conflicts
      if (companyConnections[regNum]) {
        try { companyConnections[regNum].close(); } catch(e){}
        delete companyConnections[regNum];
      }
      await initializeCompanySchema(regNum, companyName, adminEmail, adminPasswordHash, adminPlainPassword);
    }
  }
}

/**
 * Helper to fetch the number of telecallers inside a company's SQLite database file.
 */
async function getCompanyTelecallerCount(regNum) {
  if (dbType === 'postgres') {
    const schemaName = `company_${regNum}`;
    const client = await pgPool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const res = await client.query("SELECT COUNT(*) as count FROM users WHERE role = 'telecaller'");
      return parseInt(res.rows[0].count) || 0;
    } finally {
      client.release();
    }
  }

  const sqliteFile = path.join(getDatabasesDir(), `company_${regNum}.sqlite`);
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
  ensureCompanySchema,
  getCompanyTelecallerCount,
  closeCompanyConnection,
  getDatabasesDir,
  dbStorage,
  dbType,
  pgPool,
};
