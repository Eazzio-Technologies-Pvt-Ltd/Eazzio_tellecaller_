/**
 * migrate_sqlite_to_neon.js
 * 
 * Script to migrate all master and tenant database tables from SQLite
 * (backend/database.sqlite and backend/databases/*.sqlite) to Neon DB (PostgreSQL).
 * 
 * Run with: node migrate_sqlite_to_neon.js
 */

const { Client } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

if (process.env.DB_TYPE !== 'postgres' || !process.env.DATABASE_URL) {
  console.error('ERROR: Set DB_TYPE=postgres and DATABASE_URL in .env to run this script.');
  process.exit(1);
}

const sqliteMainPath = path.resolve(__dirname, 'database.sqlite');
const tenantsDir = path.resolve(__dirname, 'databases');

const pgClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Helper wrapper to run sqlite query
function sqliteQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper to construct and run dynamic INSERT in PostgreSQL
async function insertIntoPg(client, schemaName, tableName, rows) {
  if (!rows || rows.length === 0) return 0;
  
  const columns = Object.keys(rows[0]);
  const columnList = columns.map(c => `"${c}"`).join(', ');
  let successCount = 0;
  
  // For contacts, fetch existing campaign IDs in Postgres to avoid FK constraint issues
  let existingCampaignIds = new Set();
  if (tableName === 'contacts') {
    try {
      const campRes = await client.query(`SELECT id FROM "${schemaName}"."campaigns"`);
      existingCampaignIds = new Set(campRes.rows.map(r => r.id));
    } catch (e) {
      // campaigns table might not exist in this schema yet
    }
  }
  
  for (const row of rows) {
    const values = columns.map(col => {
      let val = row[col];
      // Map missing campaigns to null in contacts
      if (tableName === 'contacts' && col === 'campaign_id' && val !== null) {
        if (!existingCampaignIds.has(val)) {
          val = null;
        }
      }
      return val;
    });
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    // Explicitly set the target search path or use fully qualified table name
    const query = `INSERT INTO "${schemaName}"."${tableName}" (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
    
    try {
      await client.query(query, values);
      successCount++;
    } catch (err) {
      console.error(`     ✗ Error inserting row into ${schemaName}.${tableName}: ${err.message}`);
    }
  }
  
  return successCount;
}

async function migrateTable(sqliteDb, pgClient, schemaName, tableName) {
  try {
    // Check if table exists in SQLite
    const tableExists = await sqliteQuery(sqliteDb, 
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [tableName]
    );
    if (tableExists.length === 0) {
      console.log(`   ~ Table ${tableName} does not exist in SQLite source. Skipping.`);
      return;
    }

    const rows = await sqliteQuery(sqliteDb, `SELECT * FROM ${tableName}`);
    console.log(`   → Migrating ${tableName}: ${rows.length} rows...`);
    
    if (rows.length > 0) {
      const inserted = await insertIntoPg(pgClient, schemaName, tableName, rows);
      console.log(`   ✓ Successfully inserted ${inserted}/${rows.length} rows into PG schema "${schemaName}"`);
    } else {
      console.log(`   ✓ 0 rows to migrate for ${tableName}`);
    }
  } catch (err) {
    console.error(`   ✗ Failed to migrate table ${tableName}: ${err.message}`);
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   Eazzio SQLite → Neon DB Data Migrator  ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log(`Connecting to Neon PostgreSQL...`);
  await pgClient.connect();
  console.log(`✓ Connected to Neon DB.\n`);

  console.log(`Source SQLite Master database: ${sqliteMainPath}`);
  if (!fs.existsSync(sqliteMainPath)) {
    console.error(`ERROR: SQLite master database not found at: ${sqliteMainPath}`);
    process.exit(1);
  }

  const mainSqliteDb = new sqlite3.Database(sqliteMainPath);

  // 1. Migrate public / master tables
  console.log('==========================================');
  console.log(' PUBLIC SCHEMA MIGRATION');
  console.log('==========================================');
  
  // Truncate existing public tables first to avoid unique constraint violations
  const publicTables = ['companies', 'users', 'campaigns', 'contacts', 'support_tickets', 'password_resets'];
  for (const table of publicTables) {
    try {
      await pgClient.query(`TRUNCATE TABLE "public"."${table}" CASCADE`);
      console.log(`Cleared PG public.${table}`);
    } catch (e) {
      // Ignore if table not present or truncate fails
    }
  }
  console.log('');

  // Migrate in dependency order
  await migrateTable(mainSqliteDb, pgClient, 'public', 'companies');
  await migrateTable(mainSqliteDb, pgClient, 'public', 'users');
  await migrateTable(mainSqliteDb, pgClient, 'public', 'campaigns');
  await migrateTable(mainSqliteDb, pgClient, 'public', 'contacts');
  await migrateTable(mainSqliteDb, pgClient, 'public', 'support_tickets');
  await migrateTable(mainSqliteDb, pgClient, 'public', 'password_resets');

  // 2. Load companies to migrate dynamic tenant databases
  const companies = await sqliteQuery(mainSqliteDb, 'SELECT reg_num, name FROM companies');
  console.log(`\nFound ${companies.length} companies to migrate dynamic tenant data.`);

  for (const company of companies) {
    const regNum = company.reg_num;
    const schemaName = `company_${regNum}`;
    
    // Check both standard name and name without EAZ- prefix
    let tenantDbPath = path.join(tenantsDir, `company_${regNum}.sqlite`);
    if (!fs.existsSync(tenantDbPath)) {
      const strippedRegNum = regNum.replace('EAZ-', '');
      tenantDbPath = path.join(tenantsDir, `company_${strippedRegNum}.sqlite`);
    }
    
    console.log('\n==========================================');
    console.log(` TENANT MIGRATION: ${company.name} (${regNum})`);
    console.log('==========================================');
    
    if (!fs.existsSync(tenantDbPath)) {
      console.warn(`⚠ Warning: Tenant SQLite file not found at: ${tenantDbPath}`);
      console.log('   (If this company is a fresh signup without local DB entries, skipping is normal)');
      continue;
    }
    
    console.log(`Found tenant database at: ${tenantDbPath}`);
    const tenantSqliteDb = new sqlite3.Database(tenantDbPath);
    
    // Truncate tenant tables to prevent conflicts
    const tenantTables = [
      'users', 'campaigns', 'contacts', 'call_logs', 
      'lead_transfers', 'telecaller_sessions', 'admin_notifications'
    ];
    
    for (const table of tenantTables) {
      try {
        await pgClient.query(`TRUNCATE TABLE "${schemaName}"."${table}" CASCADE`);
      } catch (e) {}
    }
    
    // Migrate tenant tables in order
    await migrateTable(tenantSqliteDb, pgClient, schemaName, 'users');
    await migrateTable(tenantSqliteDb, pgClient, schemaName, 'campaigns');
    await migrateTable(tenantSqliteDb, pgClient, schemaName, 'contacts');
    await migrateTable(tenantSqliteDb, pgClient, schemaName, 'call_logs');
    await migrateTable(tenantSqliteDb, pgClient, schemaName, 'lead_transfers');
    await migrateTable(tenantSqliteDb, pgClient, schemaName, 'telecaller_sessions');
    await migrateTable(tenantSqliteDb, pgClient, schemaName, 'admin_notifications');
    
    tenantSqliteDb.close();
  }

  mainSqliteDb.close();
  await pgClient.end();
  
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  ✅  SQLite → Neon DB migration COMPLETE! ║');
  console.log('╚══════════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('\n❌ Fatal Migration Error:', err.message);
  process.exit(1);
});
