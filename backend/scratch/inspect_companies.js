const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
console.log('Reading from:', dbPath);

const db = new sqlite3.Database(dbPath);
db.all("SELECT id, name, reg_num, admin_email, subscription_end, plan_type FROM companies", [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('SQLite Companies:', rows);
  }
  db.close();
});
