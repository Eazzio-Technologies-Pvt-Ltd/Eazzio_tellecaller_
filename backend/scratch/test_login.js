async function test() {
  const payload = {
    email: 'thesisinstitute@gmail.com',
    password: 'thesis123'
  };
  
  console.log('Logging in as company admin...');
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const loginData = await loginRes.json();
    if (!loginRes.ok || !loginData.token) {
      console.log('Login failed:', loginData);
      return;
    }
    
    const token = loginData.token;
    const headers = { 'Authorization': `Bearer ${token}` };

    const endpoints = [
      '/api/auth/me',
      '/api/call-logs/analytics',
      '/api/call-logs',
      '/api/campaigns',
      '/api/auth/company-billing'
    ];

    for (const ep of endpoints) {
      console.log(`Fetching ${ep}...`);
      const res = await fetch(`http://localhost:5000${ep}`, { headers });
      console.log(`Status for ${ep}:`, res.status);
      const data = await res.json();
      if (!res.ok) {
        console.log(`Error body for ${ep}:`, data);
      } else {
        console.log(`Success keys for ${ep}:`, Object.keys(data));
      }
    }
  } catch (err) {
    console.error('Error during test:', err);
  }
}

test();
