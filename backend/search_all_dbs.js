const { Client } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function searchSqlite() {
  console.log('=== SEARCHING SQLITE ===');
  const databasesDir = path.resolve(__dirname, 'databases');
  if (!fs.existsSync(databasesDir)) {
    console.log('No SQLite databases folder found');
    return;
  }
  
  const files = fs.readdirSync(databasesDir);
  for (const file of files) {
    if (file.endsWith('.sqlite')) {
      const dbPath = path.join(databasesDir, file);
      await new Promise((resolve) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
          if (err) {
            console.log(`Failed to open SQLite: ${file}`, err.message);
            return resolve();
          }
          
          db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, tables) => {
            if (err || !tables || tables.length === 0) {
              db.close();
              return resolve();
            }
            
            db.all("SELECT * FROM users", (err, rows) => {
              db.close();
              if (err) {
                console.log(`Failed to query users in SQLite: ${file}`, err.message);
                return resolve();
              }
              
              const matches = rows.filter(r => 
                (r.email && r.email.includes('thesis')) || 
                (r.name && r.name.includes('thesis')) ||
                (r.plain_password && r.plain_password.includes('thesis'))
              );
              
              if (matches.length > 0) {
                console.log(`[SQLITE MATCH] Found in database ${file}:`, matches);
              }
              resolve();
            });
          });
        });
      });
    }
  }
}

async function searchPostgres() {
  console.log('=== SEARCHING POSTGRES ===');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log('No DATABASE_URL found in .env');
    return;
  }
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    
    // Search public.companies
    const companiesRes = await client.query('SELECT * FROM companies');
    const compMatches = companiesRes.rows.filter(c => 
      (c.admin_email && c.admin_email.includes('thesis')) || 
      (c.name && c.name.includes('thesis'))
    );
    if (compMatches.length > 0) {
      console.log('[POSTGRES MATCH] Found in public.companies:', compMatches);
    }
    
    // Search public.users
    const usersRes = await client.query('SELECT * FROM users');
    const userMatches = usersRes.rows.filter(u => 
      (u.email && u.email.includes('thesis')) || 
      (u.name && u.name.includes('thesis'))
    );
    if (userMatches.length > 0) {
      console.log('[POSTGRES MATCH] Found in public.users:', userMatches);
    }
    
    // Get all schemas
    const schemasRes = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'company_%'
    `);
    
    for (const schemaRow of schemasRes.rows) {
      const schemaName = schemaRow.schema_name;
      try {
        await client.query(`SET search_path TO "${schemaName}"`);
        const schemaUsersRes = await client.query('SELECT * FROM users');
        const schemaUserMatches = schemaUsersRes.rows.filter(u => 
          (u.email && u.email.includes('thesis')) || 
          (u.name && u.name.includes('thesis')) ||
          (u.plain_password && u.plain_password.includes('thesis'))
        );
        if (schemaUserMatches.length > 0) {
          console.log(`[POSTGRES MATCH] Found in schema "${schemaName}".users:`, schemaUserMatches);
        }
      } catch (schemaErr) {
        console.error(`Failed to query schema ${schemaName}:`, schemaErr.message);
      }
    }
    
  } catch (err) {
    console.error('Postgres error:', err);
  } finally {
    await client.end();
  }
}

async function run() {
  await searchSqlite();
  await searchPostgres();
  console.log('Search finished.');
}

run();
