const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('path');

const dbPath = path.resolve(__dirname, '../database.sqlite');
console.log('Reading from:', dbPath);

const db = new sqlite3.Database(dbPath);
db.all("SELECT * FROM companies WHERE reg_num = 'EAZ-552057'", [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Thesis Institute Company Info:', rows);
  }
  db.close();
});
