const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5000;

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

function uploadCsv(path, campaignId, csvContent, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
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
  console.log('--- Testing CSV Import robustness ---');

  // 1. Get Admin login token
  console.log('Logging in as Admin (tellecaller111)...');
  const adminLogin = await makeJsonRequest('POST', '/api/auth/login', {
    email: 'tellecaller111@eazzio.com',
    password: 'eazziotellecaller111'
  });
  if (adminLogin.status !== 200) {
    console.error('Admin login failed:', adminLogin.body);
    process.exit(1);
  }
  const adminToken = adminLogin.body.token;

  // 2. Fetch or create a campaign
  console.log('Creating/Fetching Campaign...');
  const createRes = await makeJsonRequest('POST', '/api/campaigns', {
    name: 'Robustness Verification Campaign',
    description: 'Campaign to verify CSV parser improvements'
  }, adminToken);
  
  let campaignId;
  if (createRes.status === 201) {
    campaignId = createRes.body.id;
  } else {
    // try to fetch campaigns
    const listRes = await makeJsonRequest('GET', '/api/campaigns', null, adminToken);
    campaignId = listRes.body[0].id;
  }
  console.log(`Campaign ID: ${campaignId}`);

  // Test 1: Standard CSV
  console.log('\n--- Test 1: Standard CSV ---');
  const csvStandard = 'Name,Phone\nJohn Doe,9998887776\nJane Smith,8887776665';
  const res1 = await uploadCsv('/api/contacts/import', campaignId, csvStandard, adminToken);
  console.log('Response status:', res1.status);
  console.log('Response body:', res1.body);

  // Test 2: UTF-8 BOM CSV (starts with \ufeff)
  console.log('\n--- Test 2: UTF-8 BOM CSV ---');
  const csvBom = '\ufeffName,Phone\nBOM User,1112223334';
  const res2 = await uploadCsv('/api/contacts/import', campaignId, csvBom, adminToken);
  console.log('Response status:', res2.status);
  console.log('Response body:', res2.body);

  // Test 3: Synonyms CSV (Mobile, full name, whitespace headers)
  console.log('\n--- Test 3: Synonym Column Headers ---');
  const csvSynonyms = '  Full Name  ,  Mobile Number  \nSynonym User,5554443332';
  const res3 = await uploadCsv('/api/contacts/import', campaignId, csvSynonyms, adminToken);
  console.log('Response status:', res3.status);
  console.log('Response body:', res3.body);

  console.log('\n--- Checking imported contacts ---');
  const contactsRes = await makeJsonRequest('GET', `/api/contacts?campaignId=${campaignId}`, null, adminToken);
  if (contactsRes.status === 200) {
    console.log(`Successfully fetched ${contactsRes.body.length} contacts:`);
    contactsRes.body.forEach(c => {
      console.log(`- ${c.name} (${c.phone_number})`);
    });
  } else {
    console.error('Failed to fetch contacts:', contactsRes.body);
  }

  process.exit(0);
}

runTest().catch(console.error);
