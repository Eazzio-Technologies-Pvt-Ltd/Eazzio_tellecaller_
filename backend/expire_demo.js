const db = require('./config/database');

async function run() {
  try {
    console.log('Initializing schema and running migrations...');
    await db.initializeSchema();
    console.log('Database initialized successfully.');

    // Now update database with PostgreSQL syntax
    const updateSql = db.dbType === 'postgres' 
      ? "UPDATE companies SET subscription_end = NOW() - INTERVAL '2 hours' WHERE reg_num LIKE 'EAZ-DEMO-%'"
      : "UPDATE companies SET subscription_end = datetime('now', '-2 hours') WHERE reg_num LIKE 'EAZ-DEMO-%'";
      
    await db.queryMain(updateSql);
    console.log('Successfully expired demo workspaces.');

    const result = await db.queryMain("SELECT reg_num, subscription_end, mac_address FROM companies");
    console.log('Current companies in DB:', result.rows);
  } catch (err) {
    console.error('Error during migration/update:', err);
  } finally {
    process.exit(0);
  }
}

run();
