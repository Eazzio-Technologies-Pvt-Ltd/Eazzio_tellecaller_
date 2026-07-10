const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function clean() {
  const client = await pool.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS "company_EAZ-397728" CASCADE');
    console.log('✓ Dropped company_EAZ-397728 (TATA STEEL)');
    await client.query('DROP SCHEMA IF EXISTS "company_EAZ-569502" CASCADE');
    console.log('✓ Dropped company_EAZ-569502 (Demo Company)');
    await client.query('SET search_path TO public');
    const del = await client.query("DELETE FROM companies WHERE reg_num IN ('EAZ-397728','EAZ-569502') RETURNING name, reg_num");
    console.log('✓ Deleted from companies table:', del.rows.map(r => r.name).join(', '));
    const rem = await client.query('SELECT id, name, reg_num, admin_email FROM companies');
    console.log('\nRemaining companies in NeonDB:');
    rem.rows.forEach(r => console.log(' -', r.name, '|', r.reg_num, '|', r.admin_email));
  } finally {
    client.release();
    await pool.end();
  }
}
clean().catch(e => { console.error('Error:', e.message); process.exit(1); });
