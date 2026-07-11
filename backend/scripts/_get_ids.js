const db = require('../config/database');
async function main() {
  try {
    const r = await db.query("SELECT id, name FROM users WHERE role = 'telecaller' LIMIT 3");
    console.log('ROWS:' + JSON.stringify(r.rows));
  } catch (e) {
    console.error('ERR:' + e.message);
  }
  process.exit(0);
}
main();
