const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const sqliteDbFile = path.resolve(__dirname, '../databases/company_552057.sqlite');
console.log('company_552057.sqlite path:', sqliteDbFile);
console.log('company_552057.sqlite exists:', fs.existsSync(sqliteDbFile));

if (fs.existsSync(sqliteDbFile)) {
  const db = new sqlite3.Database(sqliteDbFile);
  db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) {
      console.error('Error fetching users:', err);
    } else {
      console.log('--- sqlite company_552057 users ---');
      console.log(rows);
    }
    db.close();
  });
}
