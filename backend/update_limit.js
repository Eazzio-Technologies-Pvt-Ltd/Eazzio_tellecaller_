const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_nlez3tTpKUI6@ep-restless-dawn-atvwqsto-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  });
  try {
    await client.connect();
    await client.query("UPDATE companies SET no_of_telecallers = 10 WHERE reg_num = 'EAZ-552057'");
    console.log('Updated telecaller limit to 10.');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
