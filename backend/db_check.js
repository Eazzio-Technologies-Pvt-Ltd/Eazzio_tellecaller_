const db = require('./config/database');

async function checkDb() {
  try {
    await db.initializeSchema();
    const users = await db.queryMain('SELECT id, name, email, role, plain_password FROM users');
    console.log('--- USERS ---');
    console.log(users.rows);

    const companies = await db.queryMain('SELECT * FROM companies');
    console.log('--- COMPANIES ---');
    console.log(companies.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkDb();
