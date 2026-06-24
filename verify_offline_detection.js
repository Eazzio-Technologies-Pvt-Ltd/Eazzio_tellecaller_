const http = require('http');

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

async function runTest() {
  console.log('--- Testing Offline Connection Loss Detection ---');

  // 1. Admin Login
  console.log('Logging in as Admin...');
  const adminLogin = await makeJsonRequest('POST', '/api/auth/login', {
    email: process.env.TEST_ADMIN_EMAIL || 'tellecaller111@eazzio.com',
    password: process.env.TEST_ADMIN_PASSWORD || 'eazziotellecaller111'
  });
  const adminToken = adminLogin.body.token;

  // 2. Register/Login a Test Telecaller
  const testEmail = `offline-test-${Date.now()}@eazzio.com`;
  console.log(`Registering test telecaller: ${testEmail}...`);
  await makeJsonRequest('POST', '/api/auth/register', {
    name: 'Offline Test User',
    email: testEmail,
    role: 'telecaller'
  }, adminToken);

  console.log(`Logging in test telecaller to go online...`);
  const callerLogin = await makeJsonRequest('POST', '/api/auth/login', {
    email: testEmail,
    companyRegNum: process.env.TEST_COMPANY_REG_NUM || 'EAZ-552057'
  });
  
  // Verify telecaller is online initially
  let callersRes = await makeJsonRequest('GET', '/api/auth/telecallers', null, adminToken);
  let testUser = callersRes.body.find(tc => tc.email === testEmail);
  console.log(`Initial Status: ${testUser ? testUser.status : 'Not Found'}`);
  
  if (!testUser || testUser.status !== 'online') {
    console.error('❌ Telecaller is not online after login.');
    process.exit(1);
  }

  // 3. Wait for 50 seconds (background job checks every 10s and uses 35s threshold)
  const waitTime = 50;
  console.log(`Waiting ${waitTime} seconds without any telecaller activity to simulate connection loss...`);
  await new Promise(resolve => setTimeout(resolve, waitTime * 1000));

  // 4. Verify telecaller is auto-set to offline
  console.log('Checking telecaller status after inactivity...');
  callersRes = await makeJsonRequest('GET', '/api/auth/telecallers', null, adminToken);
  testUser = callersRes.body.find(tc => tc.email === testEmail);
  console.log(`Status after inactivity: ${testUser ? testUser.status : 'Not Found'}`);

  if (!testUser || testUser.status !== 'offline') {
    console.error('❌ Inactivity detection failed. User is still:', testUser ? testUser.status : 'Unknown');
    process.exit(1);
  }
  console.log('✅ Inactivity offline detection verified.');

  // 5. Verify notification was inserted
  console.log('Checking notifications list...');
  const notificationsRes = await makeJsonRequest('GET', '/api/notifications', null, adminToken);
  const offlineNotif = notificationsRes.body.find(n => n.message.includes('Offline Test User went offline (connection lost)'));
  
  if (offlineNotif) {
    console.log(`✅ Notification verified: "${offlineNotif.message}"`);
  } else {
    console.error('❌ Notification not found. Current alerts:', notificationsRes.body);
    process.exit(1);
  }

  console.log('--- Offline Connection Loss Detection Test Successful ---');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
