async function test() {
  const regPayload = {
    name: 'Demo Admin User',
    email: 'newdemocompany@eazzio.com',
    password: 'password123',
    companyName: 'New Demo Company',
    nature: 'Retail'
  };

  console.log('1. Registering new demo company...');
  try {
    const regRes = await fetch('http://localhost:5000/api/auth/register-demo-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload)
    });

    const regData = await regRes.json();
    console.log('Registration response:', regRes.status, regData);
    if (!regRes.ok) return;

    const loginPayload = {
      email: 'newdemocompany@eazzio.com',
      password: 'password123'
    };

    console.log('\n2. Logging in as new demo company admin...');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload)
    });

    const loginData = await loginRes.json();
    console.log('Login response:', loginRes.status, loginData);
    if (!loginRes.ok || !loginData.token) return;

    const token = loginData.token;
    const headers = { 'Authorization': `Bearer ${token}` };

    console.log('\n3. Validating session with /api/auth/me...');
    const meRes = await fetch('http://localhost:5000/api/auth/me', { headers });
    const meData = await meRes.json();
    console.log('Me response:', meRes.status, meData);

  } catch (err) {
    console.error('Error during test:', err);
  }
}

test();
