const http = require('http');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

// Helper to make requests
function makeRequest(method, path, body = null, token = null) {
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

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(dataStr);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = responseBody ? JSON.parse(responseBody) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: responseBody });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(dataStr);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting API Integration Tests ---');
  
  let adminToken = '';
  let telecallerToken = '';
  let campaignId = null;
  let contactId = null;

  // 1. Login as Admin
  try {
    console.log('Testing Admin Login...');
    const res = await makeRequest('POST', '/api/auth/login', {
      email: process.env.TEST_ADMIN_EMAIL || 'tellecaller111@eazzio.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'eazziotellecaller111'
    });
    
    if (res.status === 200 && res.body.token) {
      adminToken = res.body.token;
      console.log('✅ Admin Login successful.');
    } else {
      console.error('❌ Admin Login failed:', res.body);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Admin Login connection error:', err.message);
    process.exit(1);
  }

  // 2. Register a Telecaller
  try {
    console.log('Testing Telecaller Registration...');
    const res = await makeRequest('POST', '/api/auth/register', {
      name: 'John Telecaller',
      email: 'john@eazzio.com',
      password: 'caller_password_123',
      role: 'telecaller'
    }, adminToken);

    if (res.status === 201 || (res.status === 400 && res.body.error.includes('exists'))) {
      console.log('✅ Telecaller registered (or already exists).');
    } else {
      console.error('❌ Telecaller registration failed:', res.body);
    }
  } catch (err) {
    console.error('❌ Registration error:', err);
  }

  // 3. Login as Telecaller
  try {
    console.log('Testing Telecaller Login...');
    const res = await makeRequest('POST', '/api/auth/login', {
      email: 'john@eazzio.com',
      password: 'caller_password_123',
      companyRegNum: process.env.TEST_COMPANY_REG_NUM || 'EAZ-552057'
    });

    if (res.status === 200 && res.body.token) {
      telecallerToken = res.body.token;
      console.log('✅ Telecaller login successful.');
    } else {
      console.error('❌ Telecaller login failed:', res.body);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Telecaller Login connection error:', err);
    process.exit(1);
  }

  // 4. Create a Campaign
  try {
    console.log('Creating Campaign...');
    const res = await makeRequest('POST', '/api/campaigns', {
      name: 'Summer Outreach Campaign',
      description: 'Call leads about new summer subscription plans.'
    }, adminToken);

    if (res.status === 201) {
      campaignId = res.body.id;
      console.log(`✅ Campaign created successfully. ID: ${campaignId}`);
    } else {
      console.error('❌ Failed to create campaign:', res.body);
    }
  } catch (err) {
    console.error('❌ Campaign creation error:', err);
  }

  // 5. Update Telecaller status to calling
  try {
    console.log('Updating Telecaller status to "calling"...');
    const res = await makeRequest('POST', '/api/auth/status', { status: 'calling' }, telecallerToken);
    if (res.status === 200) {
      console.log('✅ Status updated successfully.');
    } else {
      console.error('❌ Status update failed:', res.body);
    }
  } catch (err) {
    console.error('❌ Status change error:', err);
  }

  console.log('--- All API tests finished successfully ---');
  process.exit(0);
}

runTests();
