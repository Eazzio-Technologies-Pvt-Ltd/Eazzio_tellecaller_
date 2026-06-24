const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_nlez3tTpKUI6@ep-restless-dawn-atvwqsto-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  });
  try {
    await client.connect();
    await client.query('SET search_path TO "company_EAZ-552057"');
    const userRes = await client.query('SELECT id, name, email, role, plain_password FROM users');
    console.log('--- COMPANY USERS ---');
    console.log(userRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
