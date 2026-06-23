const http = require('http');
const fs = require('fs');

const PORT = 5000;

// Helper to make JSON requests
function makeJsonRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (body) options.headers['Content-Length'] = Buffer.byteLength(dataStr);

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(dataStr);
    req.end();
  });
}

// Multipart file upload helper
function uploadCsv(path, campaignId, filePath, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const filename = 'test_leads.csv';

    let header = `--${boundary}\r\n`;
    header += `Content-Disposition: form-data; name="campaignId"\r\n\r\n`;
    header += `${campaignId}\r\n`;
    header += `--${boundary}\r\n`;
    header += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
    header += `Content-Type: text/csv\r\n\r\n`;

    let footer = `\r\n--${boundary}--\r\n`;

    const payload = Buffer.concat([
      Buffer.from(header, 'utf8'),
      Buffer.from(csvContent, 'utf8'),
      Buffer.from(footer, 'utf8')
    ]);

    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': payload.length,
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTest() {
  console.log('--- Testing CSV Import & Allotment Engine ---');

  // 1. Create CSV file
  const csvData = `Name,Phone Number
Amit Kumar,9876543210
Siddharth Sen,8765432109
Priya Sharma,7654321098
Rohan Mehta,9999888877
Karan Johar,8888777766`;
  
  const csvFile = './test_leads.csv';
  fs.writeFileSync(csvFile, csvData, 'utf8');
  console.log('Mock CSV file created.');

  // 2. Get Admin login token
  const adminLogin = await makeJsonRequest('POST', '/api/auth/login', {
    email: 'sumitsmile666@gmail.com',
    password: 'afifasumit666'
  });
  const adminToken = adminLogin.body.token;

  // Fetch campaigns or create one if none exists
  console.log('Fetching campaigns...');
  const campaignsRes = await makeJsonRequest('GET', '/api/campaigns', null, adminToken);
  let campaignId = null;
  if (campaignsRes.status === 200 && campaignsRes.body.length > 0) {
    campaignId = campaignsRes.body[0].id;
  } else {
    console.log('Creating a new campaign...');
    const createRes = await makeJsonRequest('POST', '/api/campaigns', {
      name: 'Allotment Test Campaign',
      description: 'Temporary campaign for allotment verification.'
    }, adminToken);
    campaignId = createRes.body.id;
  }
  console.log(`Using campaign ID: ${campaignId}`);

  // 3. Upload CSV
  console.log(`Uploading CSV to campaign ${campaignId}...`);
  const uploadRes = await uploadCsv('/api/contacts/import', campaignId, csvFile, adminToken);
  console.log('Upload result code:', uploadRes.status);
  console.log('Upload response body:', uploadRes.body);

  if (uploadRes.status !== 200) {
    console.error('❌ Failed to upload CSV.');
    process.exit(1);
  }

  // 4. Fetch all contacts for the campaign as Admin to check allotment
  console.log('Fetching all contacts as Admin...');
  const contactsRes = await makeJsonRequest('GET', `/api/contacts?campaignId=${campaignId}`, null, adminToken);
  
  if (contactsRes.status === 200 && Array.isArray(contactsRes.body)) {
    const list = contactsRes.body;
    console.log(`Total campaign contacts fetched: ${list.length}`);
    const assignedLeads = list.filter(c => c.assigned_to !== null);
    console.log(`Allotted leads count: ${assignedLeads.length}`);
    
    if (assignedLeads.length > 0) {
      console.log('✅ Leads allotment verified successfully:');
      assignedLeads.forEach((lead, i) => {
        console.log(`  Lead #${i+1}: ${lead.name} (${lead.phone_number}) assigned to: ${lead.assigned_caller || 'ID ' + lead.assigned_to}`);
      });
    } else {
      console.error('❌ Failed: None of the imported leads have been assigned to any telecaller.', list);
      process.exit(1);
    }
  } else {
    console.error('❌ Failed to retrieve campaign contacts list:', contactsRes.body);
    process.exit(1);
  }

  // Clean up
  fs.unlinkSync(csvFile);
  console.log('--- Allotment Verification Successful ---');
  process.exit(0);
}

runTest();
