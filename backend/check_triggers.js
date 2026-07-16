const db = require('./config/database');

async function checkTriggers() {
  try {
    const res = await db.queryMain(`
      SELECT 
        trigger_schema,
        trigger_name,
        event_manipulation,
        event_object_table,
        action_statement
      FROM information_schema.triggers;
    `);
    console.log('--- TRIGGERS ---');
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkTriggers();
