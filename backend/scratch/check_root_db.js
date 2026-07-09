const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const rootDbFile = path.resolve(__dirname, '../../database.sqlite');
console.log('Root database.sqlite path:', rootDbFile);
console.log('Root database.sqlite exists:', fs.existsSync(rootDbFile));

if (fs.existsSync(rootDbFile)) {
  const db = new sqlite3.Database(rootDbFile);
  db.all("SELECT * FROM companies", [], (err, rows) => {
    if (err) {
      console.error('Error fetching companies from root DB:', err);
    } else {
      console.log('--- ROOT sqlite companies ---');
      console.log(rows);
    }
    db.close();
  });
}
