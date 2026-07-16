const db = require('../config/database');

async function run() {
  await db.initializeSchema();
  const res = await db.queryMain('SELECT * FROM companies');
  console.log('COMPANIES:', res.rows);
}

run().catch(console.error);
