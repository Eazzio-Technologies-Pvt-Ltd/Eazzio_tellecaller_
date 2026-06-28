const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const sqliteDbFile = path.resolve(__dirname, 'database.sqlite');
const sqliteDbFile2 = path.resolve(__dirname, '../database.sqlite');

console.log('Backend database.sqlite exists:', fs.existsSync(sqliteDbFile));
console.log('Root database.sqlite exists:', fs.existsSync(sqliteDbFile2));

const fileToUse = fs.existsSync(sqliteDbFile) ? sqliteDbFile : sqliteDbFile2;

if (fs.existsSync(fileToUse)) {
  const db = new sqlite3.Database(fileToUse);
  db.all("SELECT * FROM companies", [], (err, rows) => {
    if (err) {
      console.error('Error fetching companies:', err);
    } else {
      console.log('--- sqlite companies ---');
      console.log(rows);
    }
    
    db.all("SELECT * FROM users", [], (err, uRows) => {
      if (err) {
        console.error('Error fetching users:', err);
      } else {
        console.log('--- sqlite users ---');
        console.log(uRows);
      }
      db.close();
    });
  });
}

// Also check sqlite files in databases directory
const databasesDir = path.resolve(__dirname, 'databases');
if (fs.existsSync(databasesDir)) {
  console.log('databases dir files:', fs.readdirSync(databasesDir));
}
