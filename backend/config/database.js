const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbType = process.env.DB_TYPE || 'sqlite';
let pgPool = null;
let sqliteDb = null;

// Promise wrappers for SQLite
const sqliteRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ rows: [], lastID: this.lastID, changes: this.changes });
    });
  });
};

const sqliteAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
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
  const sqliteFile = path.resolve(process.env.SQLITE_FILE || './database.sqlite');
  // Ensure directory exists
  const dir = path.dirname(sqliteFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  sqliteDb = new sqlite3.Database(sqliteFile);
}

/**
 * Executes a query with arguments.
 * Uses PostgreSQL ($1, $2) parameter syntax.
 * Automatically translates parameters to SQLite syntax (?) if needed.
 */
async function query(text, params = []) {
  if (dbType === 'postgres') {
    return await pgPool.query(text, params);
  } else {
    // Translate $1, $2 -> ? for SQLite
    const sqliteText = text.replace(/\$\d+/g, '?');
    
    // Determine whether to use run or all
    const cleanText = sqliteText.trim().toLowerCase();
    const isSelect = cleanText.startsWith('select') || cleanText.startsWith('with') || cleanText.includes('returning');
    
    if (isSelect) {
      return await sqliteAll(sqliteText, params);
    } else {
      return await sqliteRun(sqliteText, params);
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

    // Voice files table
    `CREATE TABLE IF NOT EXISTS voice_files (
      id ${serialType},
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      file_name VARCHAR(100) NOT NULL,
      file_path ${textType} NOT NULL,
      uploaded_at ${timestampType}
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
      await query(sql);
    } catch (err) {
      console.error('Error running migrations:', err);
      process.exit(1);
    }
  }

  // Add plain_password column if it doesn't exist
  try {
    await query('ALTER TABLE users ADD COLUMN plain_password VARCHAR(255)');
    console.log('Added plain_password column to users table.');
  } catch (err) {
    // Column already exists, ignore
  }

  // Create default admin user if none exists
  try {
    const adminCheck = await query('SELECT * FROM users WHERE email = $1', ['admin@eazzio.com']);
    if (adminCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const adminPassHash = await bcrypt.hash('admin123', 10);
      await query(
        'INSERT INTO users (name, email, password_hash, plain_password, role) VALUES ($1, $2, $3, $4, $5)',
        ['Admin User', 'admin@eazzio.com', adminPassHash, 'admin123', 'admin']
      );
      console.log('Created default admin user: admin@eazzio.com / admin123');
    }
  } catch (err) {
    console.error('Error creating default admin user:', err);
  }

  // Migrate existing users with null plain_password to emailPrefix123
  try {
    const bcrypt = require('bcryptjs');
    const callersResult = await query("SELECT id, email FROM users WHERE (plain_password IS NULL OR plain_password = '')");
    for (const row of callersResult.rows) {
      const prefix = row.email.split('@')[0];
      const defaultPass = `${prefix}123`;
      const passHash = await bcrypt.hash(defaultPass, 10);
      await query(
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

module.exports = {
  query,
  initializeSchema,
  dbType,
};
