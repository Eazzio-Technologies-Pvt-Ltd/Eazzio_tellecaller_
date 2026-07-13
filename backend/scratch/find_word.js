const fs = require('fs');
const path = require('path');

function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'build' && file !== '.dart_tool') {
        searchDir(fullPath, query);
      }
    } else {
      if (file.endsWith('.dart') || file.endsWith('.js') || file.endsWith('.kt')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(query)) {
          console.log(`Found "${query}" in: ${fullPath}`);
        }
      }
    }
  }
}

searchDir(path.join(__dirname, '../../mobile-app'), '_wasConnected');
searchDir(path.join(__dirname, '../../admin-panel'), '_wasConnected');
searchDir(path.join(__dirname, '..'), '_wasConnected');
console.log('Search complete.');
