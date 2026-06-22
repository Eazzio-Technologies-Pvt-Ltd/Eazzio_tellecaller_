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

// Multipart call log + recording upload helper
function uploadCallLog(path, fields, filePath, token) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const audioContent = fs.readFileSync(filePath);
    const filename = 'sample_recording.m4a';

    let header = '';
    for (const [key, value] of Object.entries(fields)) {
      header += `--${boundary}\r\n`;
      header += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
      header += `${value}\r\n`;
    }

    header += `--${boundary}\r\n`;
    header += `Content-Disposition: form-data; name="recording"; filename="${filename}"\r\n`;
    header += `Content-Type: audio/m4a\r\n\r\n`;

    let footer = `\r\n--${boundary}--\r\n`;

    const payload = Buffer.concat([
      Buffer.from(header, 'utf8'),
      audioContent,
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
  console.log('--- Testing Telecaller Calling Flow & Telemetry ---');

  // 1. Create a dummy recording file
  const recFile = './sample_recording.m4a';
  fs.writeFileSync(recFile, 'dummy-audio-bytes-data', 'utf8');
  console.log('Created dummy recording audio file.');

  // 2. Login as John Telecaller
  const callerLogin = await makeJsonRequest('POST', '/api/auth/login', {
    email: 'john@eazzio.com',
    password: 'caller_password_123'
  });
  const callerToken = callerLogin.body.token;

  // 3. Fetch his allotted contacts to find the ID
  const allottedRes = await makeJsonRequest('GET', '/api/contacts/allotted', null, callerToken);
  const contact = allottedRes.body[0]; // first lead
  console.log(`Submitting call log for lead: ${contact.name} (ID: ${contact.id})`);

  // 4. Upload Call Log + Recording
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + 3); // 3 days follow up

  const fields = {
    contactId: contact.id,
    callStatus: 'connected',
    duration: 45,
    feedback: 'Wants to sign up. Follow up next Monday.',
    followUpDate: followUpDate.toISOString()
  };

  console.log('Uploading call log with recording file...');
  const uploadRes = await uploadCallLog('/api/call-logs', fields, recFile, callerToken);
  console.log('Call Log upload response code:', uploadRes.status);
  console.log('Call Log upload response body:', uploadRes.body);

  if (uploadRes.status !== 201) {
    console.error('❌ Failed to upload call log.');
    process.exit(1);
  }

  // 5. Sync telemetry timers
  console.log('Syncing telecaller telemetry timers...');
  const syncRes = await makeJsonRequest('POST', '/api/call-logs/telemetry/sync', {
    workingTime: 300,
    idleTime: 255,
    breakTime: 0,
    callingTime: 45
  }, callerToken);
  console.log('Telemetry sync response:', syncRes.status);

  // 6. Login as Admin
  const adminLogin = await makeJsonRequest('POST', '/api/auth/login', {
    email: 'admin@eazzio.com',
    password: 'admin123'
  });
  const adminToken = adminLogin.body.token;

  // 7. Get Call Logs list (Admin)
  console.log('Checking call logs list in admin database...');
  const logsRes = await makeJsonRequest('GET', '/api/call-logs', null, adminToken);
  
  if (logsRes.status === 200 && logsRes.body.length > 0) {
    const loggedCall = logsRes.body[0];
    console.log('✅ Log successfully saved and verified:');
    console.log(`  Lead: ${loggedCall.contact_name}`);
    console.log(`  Outcome: ${loggedCall.call_status}`);
    console.log(`  Talktime: ${loggedCall.duration}s`);
    console.log(`  Notes: "${loggedCall.feedback}"`);
    console.log(`  Audio Recording: http://localhost:5000${loggedCall.recording_url}`);
  } else {
    console.error('❌ Failed to find call logs:', logsRes.body);
    process.exit(1);
  }

  // 8. Get Analytics
  console.log('Verifying dashboard analytics update...');
  const analyticsRes = await makeJsonRequest('GET', '/api/call-logs/analytics', null, adminToken);
  
  if (analyticsRes.status === 200) {
    const overview = analyticsRes.body.overview;
    const callerStats = analyticsRes.body.callers[0];
    console.log('✅ Analytics sync verified:');
    console.log(`  Total talk time: ${overview.total_talk_time} seconds`);
    console.log(`  John Telecaller today working time: ${callerStats.working_time} seconds`);
    console.log(`  John Telecaller today talk time: ${callerStats.calling_time} seconds`);
    console.log(`  John Telecaller today idle time: ${callerStats.idle_time} seconds`);
  } else {
    console.error('❌ Failed to retrieve dashboard analytics:', analyticsRes.body);
    process.exit(1);
  }

  // Clean up
  fs.unlinkSync(recFile);
  console.log('--- Telecaller Calling Flow Verification Successful ---');
  process.exit(0);
}

runTest();
