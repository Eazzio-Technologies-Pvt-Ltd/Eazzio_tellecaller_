/**
 * NeonDB CLI CSV Upload Helper
 * Usage: node upload_csv_neon.js <csv_file_path> <campaign_id>
 */
const fs = require('fs');
const csv = require('csv-parser');
const db = require('./config/database');

const filePath = process.argv[2];
const campaignId = process.argv[3];

if (!filePath || !campaignId) {
  console.log('\n❌ Missing arguments.');
  console.log('Usage: node upload_csv_neon.js <csv_file_path> <campaign_id>');
  console.log('Example: node upload_csv_neon.js ../test_leads.csv 3\n');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.log(`\n❌ CSV file not found at path: ${filePath}\n`);
  process.exit(1);
}

// Run under the company registration code context
const companyRegNum = 'EAZ-552057';

db.dbStorage.run({ companyRegNum }, () => {
  const contactsToInsert = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      // Normalize keys to find Name and Phone columns
      const normalizedRow = {};
      for (const key of Object.keys(row)) {
        normalizedRow[key.trim().replace(/^\ufeff/, '').toLowerCase()] = row[key];
      }

      const nameVal = normalizedRow['name'] || normalizedRow['full name'] || 'Unknown';
      const phoneVal = normalizedRow['phone'] || normalizedRow['phone number'] || normalizedRow['mobile'];

      if (phoneVal) {
        contactsToInsert.push({
          name: String(nameVal).trim() || 'Unknown',
          phone: String(phoneVal).trim()
        });
      }
    })
    .on('end', async () => {
      console.log(`\nParsed ${contactsToInsert.length} contacts. Uploading to schema company_${companyRegNum}...`);
      
      try {
        let count = 0;
        for (const contact of contactsToInsert) {
          await db.query(
            'INSERT INTO contacts (campaign_id, name, phone_number, status) VALUES ($1, $2, $3, $4)',
            [parseInt(campaignId), contact.name, contact.phone, 'pending']
          );
          count++;
        }
        console.log(`\n✅ Success: Imported ${count} contacts to NeonDB under campaign ID ${campaignId}.\n`);
      } catch (err) {
        console.error('\n❌ Database Error during upload:', err.message);
      } finally {
        process.exit(0);
      }
    })
    .on('error', (err) => {
      console.error('\n❌ Error parsing CSV file:', err.message);
      process.exit(1);
    });
});
