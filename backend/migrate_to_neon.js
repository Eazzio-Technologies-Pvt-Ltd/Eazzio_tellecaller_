const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./config/database');

if (process.env.DB_TYPE !== 'postgres') {
  console.error("Please set DB_TYPE=postgres in your .env file to migrate to NeonDB.");
  process.exit(1);
}

// Reuse db.pgPool connection pool
const pgPool = db.pgPool;

const sqliteDbFile = path.resolve(process.env.SQLITE_FILE || './database.sqlite');

if (!fs.existsSync(sqliteDbFile)) {
  console.error(`SQLite master database file not found at: ${sqliteDbFile}`);
  process.exit(1);
}

const sqliteDb = new sqlite3.Database(sqliteDbFile);

function sqliteQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function sanitizeValue(columnName, value) {
  if (value === null || value === undefined) {
    return null;
  }
  
  const dateColumns = [
    'last_called_at', 'follow_up_date', 'created_at', 'called_at', 
    'last_active_at', 'last_updated_at', 'subscription_start', 
    'subscription_end', 'call_recording_end_date', 'resolved_at'
  ];
  
  if (dateColumns.includes(columnName)) {
    if (value === '') return null;
    const num = Number(value);
    if (!isNaN(num) && num > 1000000000000) {
      return new Date(num).toISOString();
    }
  }
  return value;
}

async function migrateTable(tableName, pgSchema = 'public') {
  console.log(`[Migration] Migrating master table ${tableName} to PG schema ${pgSchema}...`);
  try {
    const rows = await sqliteQuery(`SELECT * FROM ${tableName}`);
    if (rows.length === 0) {
      console.log(`[Migration] Master table ${tableName} is empty.`);
      return;
    }

    const columns = Object.keys(rows[0]);
    
    const client = await pgPool.connect();
    if (client.listeners('error').length === 0) {
      client.on('error', (err) => {
        console.error('PG Client Error during migration:', err.message);
      });
    }
    
    try {
      await client.query(`SET search_path TO "${pgSchema}"`);
      await client.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
      
      for (const row of rows) {
        const colNames = columns.map(c => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(c => sanitizeValue(c, row[c]));
        
        await client.query(`INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`, values);
      }
      
      // Reset sequence
      try {
        const seqResult = await client.query(`SELECT pg_get_serial_sequence('"${pgSchema}"."${tableName}"', 'id')`);
        const seqName = seqResult.rows[0].pg_get_serial_sequence;
        if (seqName) {
          await client.query(`SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM "${tableName}"), 1))`);
        }
      } catch (seqErr) {}
      
      console.log(`[Migration] Successfully migrated ${rows.length} rows to ${pgSchema}.${tableName}`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`[Migration] Error migrating table ${tableName}:`, err.message);
  }
}

async function migrateTenantTable(sqliteConn, tableName, regNum, pgSchema) {
  return new Promise((resolve, reject) => {
    sqliteConn.all(`SELECT * FROM ${tableName}`, [], async (err, rows) => {
      if (err) {
        console.warn(`[Migration] Table ${tableName} skipped or not found in company_${regNum}.sqlite`);
        return resolve();
      }
      if (!rows || rows.length === 0) {
        return resolve();
      }
      
      const columns = Object.keys(rows[0]);
      
      let client;
      try {
        client = await pgPool.connect();
        if (client.listeners('error').length === 0) {
          client.on('error', (err) => {
            console.error('PG Client Error during tenant migration:', err.message);
          });
        }
        
        await client.query(`SET search_path TO "${pgSchema}"`);
        await client.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);
        
        for (const row of rows) {
          const colNames = columns.map(c => `"${c}"`).join(', ');
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const values = columns.map(c => sanitizeValue(c, row[c]));
          
          await client.query(`INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders})`, values);
        }
        
        // Reset sequence
        try {
          const seqResult = await client.query(`SELECT pg_get_serial_sequence('"${pgSchema}"."${tableName}"', 'id')`);
          const seqName = seqResult.rows[0].pg_get_serial_sequence;
          if (seqName) {
            await client.query(`SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM "${tableName}"), 1))`);
          }
        } catch (seqErr) {}
        
        console.log(`[Migration] Successfully migrated ${rows.length} rows to ${pgSchema}.${tableName}`);
        resolve();
      } catch (insertErr) {
        console.error(`[Migration] Error inserting into ${pgSchema}.${tableName}:`, insertErr.message);
        resolve(); // Continue with other tables/tenants
      } finally {
        if (client) client.release();
      }
    });
  });
}

async function startMigration() {
  console.log("Starting NeonDB Migration...");
  
  // 1. Initialize schemas/tables on Postgres
  await db.initializeSchema();
  
  // 2. Migrate Master tables
  const masterTables = ['companies', 'users', 'support_tickets', 'password_resets'];
  for (const table of masterTables) {
    await migrateTable(table, 'public');
  }
  
  // 3. Migrate Tenant databases
  const databasesDir = path.join(__dirname, 'databases');
  if (fs.existsSync(databasesDir)) {
    const files = fs.readdirSync(databasesDir);
    for (const file of files) {
      if (file.startsWith('company_') && file.endsWith('.sqlite')) {
        let regNum = file.replace('company_', '').replace('.sqlite', '');
        console.log(`\n--------------------------------------------`);
        console.log(`[Migration] Found tenant database file: ${file} (Reg: ${regNum})`);
        
        // Get company details from local sqlite companies table to initialize schema correctly
        let companyRows = await sqliteQuery('SELECT * FROM companies WHERE reg_num = ?', [regNum]);
        if (companyRows.length === 0 && !regNum.startsWith('EAZ-')) {
          companyRows = await sqliteQuery('SELECT * FROM companies WHERE reg_num = ?', [`EAZ-${regNum}`]);
          if (companyRows.length > 0) {
            regNum = `EAZ-${regNum}`;
          }
        }
        
        if (companyRows.length === 0) {
          console.warn(`[Migration] Company registration code ${regNum} not found in companies table. Skipping...`);
          continue;
        }
        
        const company = companyRows[0];
        const pgSchema = `company_${regNum}`;
        
        // Initialize dynamic Postgres schema
        console.log(`[Migration] Provisioning schema and tables for ${pgSchema} on PG...`);
        await db.initializeCompanySchema(
          regNum,
          company.name,
          company.admin_email,
          company.admin_password_hash,
          company.admin_plain_password
        );
        
        // Clear default admin created during schema initialization to avoid conflicts
        let client;
        try {
          client = await pgPool.connect();
          if (client.listeners('error').length === 0) {
            client.on('error', (err) => {
              console.error('PG Client Error during schema prep:', err.message);
            });
          }
          await client.query(`SET search_path TO "${pgSchema}"`);
          await client.query(`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
        } catch (prepErr) {
          console.error('[Migration] Error cleaning tenant users table:', prepErr.message);
        } finally {
          if (client) client.release();
        }
        
        // Connect to tenant sqlite DB
        const sqliteFile = path.join(databasesDir, file);
        const compDb = new sqlite3.Database(sqliteFile);
        
        try {
          const tenantTables = ['users', 'campaigns', 'contacts', 'call_logs', 'telecaller_sessions', 'admin_notifications'];
          for (const table of tenantTables) {
            await migrateTenantTable(compDb, table, regNum, pgSchema);
          }
        } catch (err) {
          console.error(`[Migration] Failed migrating tenant ${regNum}:`, err.message);
        } finally {
          compDb.close();
        }
      }
    }
  }
  
  console.log("\n============================================");
  console.log("NeonDB Migration completed successfully!");
  console.log("============================================");
  
  sqliteDb.close();
  process.exit(0);
}

startMigration().catch(err => {
  console.error("Migration fatal error:", err);
  process.exit(1);
});
