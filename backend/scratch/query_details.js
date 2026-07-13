const db = require('../config/database');

async function run() {
  try {
    const store = { companyRegNum: 'EAZ-552057' };
    
    // We run our queries within the company schema context
    const runInTenant = async () => {
      const logs = await db.query('SELECT * FROM call_logs');
      console.log('--- tenant call_logs ---');
      console.log(logs.rows);

      const activities = await db.query('SELECT * FROM call_activities');
      console.log('--- tenant call_activities ---');
      console.log(activities.rows);

      const contacts = await db.query('SELECT id, name, phone_number, status FROM contacts WHERE id IN (63, 64, 65, 67)');
      console.log('--- tenant contacts ---');
      console.log(contacts.rows);
    };

    // Use AsyncLocalStorage to set the store context
    await db.dbStorage.run(store, async () => {
      await runInTenant();
    });

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
