const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbs = [
  path.resolve(__dirname, '../../database.sqlite'),
  path.resolve(__dirname, '../database.sqlite')
];

dbs.forEach(dbPath => {
  console.log(`\nChecking DB at: ${dbPath}`);
  if (fs.existsSync(dbPath)) {
    const db = new sqlite3.Database(dbPath);
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
      if (err) {
        console.error(`Error fetching tables from ${dbPath}:`, err);
        return;
      }
      console.log(`Tables in ${path.basename(dbPath)}:`, tables.map(t => t.name));
      tables.forEach(table => {
        db.get(`SELECT COUNT(*) as count FROM ${table.name}`, [], (err, row) => {
          if (err) {
            console.error(`Error counting ${table.name} in ${dbPath}:`, err);
          } else {
            console.log(`  • Table ${table.name}: ${row.count} rows`);
          }
        });
      });
      setTimeout(() => db.close(), 1000);
    });
  } else {
    console.log('File does not exist.');
  }
});
