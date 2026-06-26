const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_eazzio_telecaller_system_2026';

// Register User — enforces telecaller cap for company admins
exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;

  const userRole = role || 'telecaller';
  const finalPassword = password || (userRole === 'telecaller' ? 'telecaller_nopassword' : '');

  if (!name || !email || !finalPassword) {
    return res.status(400).json({ error: 'Please provide name, email/mobile number, and password.' });
  }

  try {
    const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists with this email/mobile number.' });
    }

    // Enforce telecaller cap for company admins adding telecallers
    if (userRole === 'telecaller' && req.user && req.user.companyRegNum) {
      if (req.user.companyRegNum.startsWith('EAZ-DEMO-')) {
        const currentCount = await db.getCompanyTelecallerCount(req.user.companyRegNum);
        if (currentCount >= 3) {
          return res.status(403).json({
            error: 'Please purchase any subscription'
          });
        }
      } else {
        const compData = await db.queryMain('SELECT no_of_telecallers, price_per_telecaller, plan_type FROM companies WHERE reg_num = $1', [req.user.companyRegNum]);
        if (compData.rows.length > 0) {
          const allowedLimit = compData.rows[0].no_of_telecallers || 0;
          const currentCount = await db.getCompanyTelecallerCount(req.user.companyRegNum);
          if (allowedLimit > 0 && currentCount >= allowedLimit) {
            const planType = compData.rows[0].plan_type || 'monthly';
            const rate = planType === 'annual' ? 49 * 12 : 59;
            return res.status(403).json({
              error: 'limit_exceeded',
              allowedLimit,
              currentCount,
              planType,
              rate,
              message: `Telecaller limit of ${allowedLimit} reached. Adding this telecaller requires a payment of ₹${rate} for an extra seat.`
            });
          }
        }
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(finalPassword, salt);

    await db.query(
      'INSERT INTO users (name, email, password_hash, plain_password, role) VALUES ($1, $2, $3, $4, $5)',
      [name, email, passwordHash, finalPassword, userRole]
    );

    res.status(201).json({
      message: 'User registered successfully.'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
};

// Login User
exports.login = async (req, res) => {
  const { email, password, companyRegNum } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Please provide email or mobile number.' });
  }

  try {
    // Case 1: Telecaller login (requires mobile number & companyRegNum)
    if (companyRegNum) {
      // Verify company registration number exists in master db
      const compCheck = await db.queryMain('SELECT * FROM companies WHERE reg_num = $1', [companyRegNum]);
      if (compCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid Company Registration Number.' });
      }

      // Check if company subscription has expired
      const company = compCheck.rows[0];
      if (company.subscription_end) {
        const now = new Date();
        let expiryStr = company.subscription_end.toString();
        if (!expiryStr.includes('Z') && !expiryStr.includes('T')) {
          expiryStr = expiryStr.replace(' ', 'T') + 'Z';
        }
        const expiry = new Date(expiryStr);
        if (expiry < now) {
          return res.status(403).json({ 
            error: 'Your company\'s Eazzio subscription has expired. Please contact your company administrator to renew the plan.' 
          });
        }
      }

      // Search users in the company database (routed automatically by middleware dbStorage)
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid registered mobile number for this company.' });
      }

      const user = result.rows[0];
      if (user.role !== 'telecaller') {
        return res.status(400).json({ error: 'Invalid role for mobile application login.' });
      }

      // Update status to online in company database
      await db.query('UPDATE users SET status = $1, last_active_at = CURRENT_TIMESTAMP WHERE id = $2', ['online', user.id]);

      // Create notification in company database
      try {
        await db.query(
          'INSERT INTO admin_notifications (message) VALUES ($1)',
          [`Telecaller ${user.name} went online`]
        );
      } catch (err) {
        console.error('Error logging online notification:', err);
      }

      // Ensure session exists for today in company database
      const today = new Date().toISOString().split('T')[0];
      const sessionCheck = await db.query(
        'SELECT * FROM telecaller_sessions WHERE telecaller_id = $1 AND date = $2',
        [user.id, today]
      );
      if (sessionCheck.rows.length === 0) {
        try {
          await db.query(
            'INSERT INTO telecaller_sessions (telecaller_id, date) VALUES ($1, $2)',
            [user.id, today]
          );
        } catch (insertErr) {
          // Ignore unique constraint violation (session already exists)
          console.log(`[Session] Session already exists for telecaller ID ${user.id} on date ${today}`);
        }
      }

      // Generate token with companyRegNum
      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role, companyRegNum },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      // Save token to database for single device session verification
      await db.query('UPDATE users SET current_token = $1 WHERE id = $2', [token, user.id]);

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: 'online',
          companyRegNum
        }
      });
    }

    // Case 2: Web Login (Eazzio Admin or Company Admin)
    // Check if Eazzio Admin (email is tellecaller111@eazzio.com)
    if (email === 'tellecaller111@eazzio.com') {
      const result = await db.queryMain('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      const user = result.rows[0];
      if (!password) {
        return res.status(400).json({ error: 'Please provide password.' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: 'admin', companyRegNum: null },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: 'admin',
          companyRegNum: null
        }
      });
    }

    // Check if Company Admin (admin email matches registered companies)
    const compCheck = await db.queryMain('SELECT * FROM companies WHERE admin_email = $1', [email]);
    if (compCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const company = compCheck.rows[0];
    if (!password) {
      return res.status(400).json({ error: 'Please provide password.' });
    }

    const isMatch = await bcrypt.compare(password, company.admin_password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    // Generate token with companyRegNum
    const token = jwt.sign(
      { id: 1, name: company.name + ' Admin', email: company.admin_email, role: 'admin', companyRegNum: company.reg_num },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: 1,
        name: company.name + ' Admin',
        email: company.admin_email,
        role: 'admin',
        companyRegNum: company.reg_num
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

// Register a new company and provision its isolated SQLite database
exports.registerCompany = async (req, res) => {
  const { name, nature, noOfTelecallers, email, password } = req.body;

  if (!name || !nature || !email || !password) {
    return res.status(400).json({ error: 'Please provide all required fields: name, nature, email, and password.' });
  }

  try {
    // 1. Check if company admin email already exists in master db companies table
    const companyExists = await db.queryMain('SELECT * FROM companies WHERE admin_email = $1', [email]);
    if (companyExists.rows.length > 0) {
      return res.status(400).json({ error: 'A company with this admin email is already registered.' });
    }

    // Also check if it's the reserved tellecaller111@eazzio.com email
    if (email === 'tellecaller111@eazzio.com') {
      return res.status(400).json({ error: 'This email is reserved for the platform administrator.' });
    }

    // 2. Generate a unique company registration number (e.g. EAZ-123456)
    let isUnique = false;
    let regNum = '';
    while (!isUnique) {
      const rand = Math.floor(100000 + Math.random() * 900000);
      regNum = `EAZ-${rand}`;
      const check = await db.queryMain('SELECT * FROM companies WHERE reg_num = $1', [regNum]);
      if (check.rows.length === 0) {
        isUnique = true;
      }
    }

    // 3. Hash the admin password
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash(password, salt);

    const numCallers = parseInt(noOfTelecallers) || 0;

    // 4. Insert company into master db companies table
    await db.queryMain(
      'INSERT INTO companies (name, nature, no_of_telecallers, reg_num, admin_email, admin_password_hash, admin_plain_password, price_per_telecaller) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [name, nature, numCallers, regNum, email, adminPasswordHash, password, 49]
    );

    // 5. Provision the isolated database schema for the company
    await db.initializeCompanySchema(regNum, name, email, adminPasswordHash, password);

    res.status(201).json({
      success: true,
      regNum,
      message: 'Company registered successfully. You can now use your credentials and registration number to log in.'
    });
  } catch (error) {
    console.error('Register company error:', error);
    res.status(500).json({ error: 'Server error during company registration.' });
  }
};

// Register a new demo company (1 week trial working mode)
exports.registerDemoCompany = async (req, res) => {
  const { name, email, macAddress } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Please provide both name and email.' });
  }

  try {
    // Check MAC Address/Device lock for demo accounts
    if (macAddress) {
      const checkMac = await db.queryMain("SELECT * FROM companies WHERE mac_address = $1 AND reg_num LIKE 'EAZ-DEMO-%'", [macAddress]);
      if (checkMac.rows.length > 0) {
        return res.status(400).json({ error: 'please take subscription' });
      }
    }

    // Generate a unique company registration number with EAZ-DEMO- prefix
    let isUnique = false;
    let regNum = '';
    while (!isUnique) {
      const rand = Math.floor(100000 + Math.random() * 900000);
      regNum = `EAZ-DEMO-${rand}`;
      const check = await db.queryMain('SELECT * FROM companies WHERE reg_num = $1', [regNum]);
      if (check.rows.length === 0) {
        isUnique = true;
      }
    }

    const companyName = `${name}'s Demo Company`;
    const defaultPassword = 'demopassword123';
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash(defaultPassword, salt);

    // Set subscription_end to 7 days from now (1 week)
    const now = new Date();
    const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // SQLite/Postgres format (YYYY-MM-DD HH:MM:SS)
    const formattedExpiry = expiry.toISOString().replace('T', ' ').substring(0, 19);

    // Insert company into master db
    await db.queryMain(
      'INSERT INTO companies (name, nature, no_of_telecallers, reg_num, admin_email, admin_password_hash, admin_plain_password, price_per_telecaller, subscription_start, subscription_end, plan_type, mac_address) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10, $11)',
      [companyName, 'Demo Workspace', 10, regNum, email, adminPasswordHash, defaultPassword, 0, formattedExpiry, 'demo', macAddress || null]
    );

    // Provision the isolated database schema
    await db.initializeCompanySchema(regNum, companyName, email, adminPasswordHash, defaultPassword);

    // Seed sample data into the tenant database
    await db.dbStorage.run({ companyRegNum: regNum }, async () => {
      // 1. Get the admin user ID
      const adminRes = await db.query("SELECT id FROM users WHERE role = 'admin'");
      const adminId = adminRes.rows[0].id;

      // 2. Insert sample telecallers
      const aaravHash = await bcrypt.hash('aarav123', 10);
      const diyaHash = await bcrypt.hash('diya123', 10);

      // Aarav (online)
      const aaravResult = await db.query(
        'INSERT INTO users (name, email, password_hash, role, status, plain_password, last_active_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id',
        ['Aarav Mehta', 'aarav@demomail.com', aaravHash, 'telecaller', 'online', 'aarav123']
      );
      const aaravId = aaravResult.rows[0].id;

      // Diya (break)
      const diyaResult = await db.query(
        'INSERT INTO users (name, email, password_hash, role, status, plain_password, last_active_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id',
        ['Diya Sharma', 'diya@demomail.com', diyaHash, 'telecaller', 'break', 'diya123']
      );
      const diyaId = diyaResult.rows[0].id;

      // 3. Insert Campaigns
      const campaign1 = await db.query(
        'INSERT INTO campaigns (name, description, status, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Real Estate Hot Leads', 'Outbound sales campaign targeting Q2 property investors.', 'active', adminId]
      );
      const c1Id = campaign1.rows[0].id;

      const campaign2 = await db.query(
        'INSERT INTO campaigns (name, description, status, created_by) VALUES ($1, $2, $3, $4) RETURNING id',
        ['Credit Card Renewals', 'Follow-up campaign for expired/renewing cards.', 'active', adminId]
      );
      const c2Id = campaign2.rows[0].id;

      // 4. Insert Contacts & Call Logs
      // Contact 1 (Connected, Rajesh)
      const contact1 = await db.query(
        'INSERT INTO contacts (campaign_id, name, phone_number, status, assigned_to, last_called_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING id',
        [c1Id, 'Rajesh Kumar', '+91 98765 00001', 'connected', aaravId]
      );
      await db.query(
        'INSERT INTO call_logs (contact_id, telecaller_id, call_status, duration, feedback, called_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
        [contact1.rows[0].id, aaravId, 'connected', 124, 'Interested in 2BHK flat. Requested site visit next Sunday.']
      );

      // Contact 2 (Follow up, Pooja)
      const contact2 = await db.query(
        'INSERT INTO contacts (campaign_id, name, phone_number, status, assigned_to, last_called_at, follow_up_date) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6) RETURNING id',
        [c1Id, 'Pooja Patel', '+91 98765 00002', 'follow_up', aaravId, new Date(Date.now() + 24 * 60 * 60 * 1000)]
      );
      await db.query(
        'INSERT INTO call_logs (contact_id, telecaller_id, call_status, duration, feedback, called_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
        [contact2.rows[0].id, aaravId, 'follow_up', 45, 'Busy right now. Asked to call back tomorrow morning at 10 AM.']
      );

      // Contact 3 (Not answered, Vikram)
      const contact3 = await db.query(
        'INSERT INTO contacts (campaign_id, name, phone_number, status, assigned_to, last_called_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING id',
        [c2Id, 'Vikram Singh', '+91 98765 00003', 'not_answered', diyaId]
      );
      await db.query(
        'INSERT INTO call_logs (contact_id, telecaller_id, call_status, duration, feedback, called_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
        [contact3.rows[0].id, diyaId, 'not_answered', 0, 'Rang twice but no response. Will re-attempt later.']
      );

      // Contact 4 (Busy, Anjali)
      const contact4 = await db.query(
        'INSERT INTO contacts (campaign_id, name, phone_number, status, assigned_to, last_called_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING id',
        [c2Id, 'Anjali Gupta', '+91 98765 00004', 'busy', diyaId]
      );
      await db.query(
        'INSERT INTO call_logs (contact_id, telecaller_id, call_status, duration, feedback, called_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
        [contact4.rows[0].id, diyaId, 'busy', 0, 'User busy. Line disconnected.']
      );

      // Add a few pending contacts (unscheduled)
      const pendingContacts = [
        ['Amit Sharma', '+91 98765 00005', c1Id, aaravId],
        ['Neha Deshmukh', '+91 98765 00006', c1Id, aaravId],
        ['Joy Dsouza', '+91 98765 00007', c1Id, null],
        ['Sunita Verma', '+91 98765 00008', c2Id, diyaId],
        ['Rohan Sen', '+91 98765 00009', c2Id, diyaId],
        ['Kavita Rao', '+91 98765 00010', c2Id, null]
      ];
      for (const item of pendingContacts) {
        await db.query(
          'INSERT INTO contacts (name, phone_number, campaign_id, assigned_to, status) VALUES ($1, $2, $3, $4, $5)',
          [item[0], item[1], item[2], item[3], 'pending']
        );
      }

      // 5. Seeding telecaller sessions for statistics
      const todayDate = new Date().toISOString().substring(0, 10);
      await db.query(
        'INSERT INTO telecaller_sessions (telecaller_id, date, total_working_time, total_calling_time, total_idle_time, total_break_time, last_updated_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
        [aaravId, todayDate, 14400, 7200, 5400, 1800]
      );
      await db.query(
        'INSERT INTO telecaller_sessions (telecaller_id, date, total_working_time, total_calling_time, total_idle_time, total_break_time, last_updated_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)',
        [diyaId, todayDate, 10800, 5400, 3600, 1800]
      );

      // 6. Seeding Admin Notifications
      await db.query('INSERT INTO admin_notifications (message) VALUES ($1)', ['Outbound dialer campaign "Real Estate Hot Leads" successfully initialized by system.']);
      await db.query('INSERT INTO admin_notifications (message) VALUES ($1)', ['Telecaller Aarav Mehta changed status to: online']);
      await db.query('INSERT INTO admin_notifications (message) VALUES ($1)', ['Telecaller Diya Sharma changed status to: break (Lunch Break)']);
    });

    // Generate JWT token for auto-login
    const token = jwt.sign(
      { id: 1, name: companyName + ' Admin', email: email, role: 'admin', companyRegNum: regNum },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: 1,
        name: companyName + ' Admin',
        email: email,
        role: 'admin',
        companyRegNum: regNum
      }
    });

  } catch (error) {
    console.error('Register demo company error:', error);
    res.status(500).json({ error: 'Server error during demo registration: ' + error.message });
  }
};

// Get list of all registered companies (Eazzio Admin only)
exports.getCompanies = async (req, res) => {
  // Safety check: ensure Eazzio Admin (not a company admin)
  if (req.user.companyRegNum !== null) {
    return res.status(403).json({ error: 'Access forbidden. Only super administrators can access company details.' });
  }

  try {
    const result = await db.queryMain('SELECT id, name, nature, no_of_telecallers, reg_num, admin_email, admin_plain_password, price_per_telecaller, edit_count, plan_type, subscription_start, subscription_end, created_at FROM companies ORDER BY created_at DESC');
    const companies = result.rows;

    // Dynamically fetch actual telecallers created in each tenant database
    for (const comp of companies) {
      comp.telecaller_count = await db.getCompanyTelecallerCount(comp.reg_num);
    }

    res.json(companies);
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Server error fetching companies.' });
  }
};

// Get superadmin dashboard metrics
exports.getSuperadminStats = async (req, res) => {
  // Safety check: ensure Eazzio Admin
  if (req.user.companyRegNum !== null) {
    return res.status(403).json({ error: 'Access forbidden. Only super administrators can access platform metrics.' });
  }

  try {
    const companiesResult = await db.queryMain('SELECT reg_num, edit_count, plan_type, no_of_telecallers FROM companies');
    const companies = companiesResult.rows;

    const totalCompanies = companies.length;
    let totalTelecallers = 0;
    let totalCharge = 0;

    // Count actual telecallers created in each tenant database
    for (const comp of companies) {
      const count = await db.getCompanyTelecallerCount(comp.reg_num);
      totalTelecallers += count;

      const plan = comp.plan_type || 'monthly';
      const seats = comp.no_of_telecallers || 0;
      let subscriptionCharge = 0;
      if (plan === 'annual') {
        subscriptionCharge = seats * 49 * 12;
      } else {
        subscriptionCharge = seats * 59;
      }
      totalCharge += subscriptionCharge;

      const edits = comp.edit_count || 0;
      const editCharge = Math.max(0, edits - 3) * 20;
      totalCharge += editCharge;
    }

    res.json({
      totalCompanies,
      totalTelecallers,
      totalCharge
    });
  } catch (error) {
    console.error('Get superadmin stats error:', error);
    res.status(500).json({ error: 'Server error retrieving platform metrics.' });
  }
};

// Per-user status update lock to prevent concurrent duplicate notifications
const _statusUpdateLocks = new Map();

async function acquireUserStatusLock(userId) {
  // If a lock chain exists, queue behind it
  const existingLock = _statusUpdateLocks.get(userId) || Promise.resolve();
  let releaseLock;
  const newLock = new Promise((resolve) => { releaseLock = resolve; });
  _statusUpdateLocks.set(userId, existingLock.then(() => newLock));
  await existingLock;
  return releaseLock;
}

// Update Telecaller Status
exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  const userId = req.user.id;
  const userName = req.user.name;
  const userRole = req.user.role;

  const validStatuses = ['online', 'offline', 'break', 'calling'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  // Acquire per-user lock so concurrent requests are serialized
  const releaseLock = await acquireUserStatusLock(userId);

  try {
    // Read current status inside the lock
    const currentResult = await db.query('SELECT status FROM users WHERE id = $1', [userId]);
    const currentStatus = currentResult.rows.length > 0 ? currentResult.rows[0].status : null;

    // Always update the timestamp, but only log notifications on actual transitions
    await db.query('UPDATE users SET status = $1, last_active_at = CURRENT_TIMESTAMP WHERE id = $2', [status, userId]);

    // Create notifications for online/offline transitions only when status actually changed
    if (userRole === 'telecaller' && currentStatus !== status) {
      if (status === 'online' || status === 'offline') {
        try {
          await db.query(
            'INSERT INTO admin_notifications (message) VALUES ($1)',
            [`Telecaller ${userName} went ${status}`]
          );
        } catch (err) {
          console.error('Error logging status transition notification:', err);
        }
      }
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ error: 'Server error updating status.' });
  } finally {
    releaseLock();
  }
};

// Get current logged in user details
exports.getMe = async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, role, status FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = result.rows[0];
    user.companyRegNum = req.user.companyRegNum !== undefined ? req.user.companyRegNum : null;

    if (user.role === 'admin' && req.user.companyRegNum) {
      const compRes = await db.queryMain('SELECT edit_count, subscription_end, plan_type, no_of_telecallers FROM companies WHERE reg_num = $1', [req.user.companyRegNum]);
      if (compRes.rows.length > 0) {
        user.editCount = compRes.rows[0].edit_count || 0;
        user.subscriptionEnd = compRes.rows[0].subscription_end || null;
        user.planType = compRes.rows[0].plan_type || 'monthly';
        user.noOfTelecallers = compRes.rows[0].no_of_telecallers || 0;
      } else {
        user.editCount = 0;
        user.subscriptionEnd = null;
        user.planType = 'monthly';
        user.noOfTelecallers = 0;
      }
    }

    res.json(user);
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

// Delete User (full cascade — removes all linked data)
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  const fs = require('fs');
  const path = require('path');

  try {
    // 1. Confirm user exists and is not admin
    const userResult = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = userResult.rows[0];
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot delete administrator account.' });
    }

    // 2. Fetch all call logs for this telecaller to delete recording files
    const callLogsResult = await db.query(
      'SELECT id, recording_url FROM call_logs WHERE telecaller_id = $1',
      [id]
    );
    for (const log of callLogsResult.rows) {
      if (log.recording_url) {
        try {
          const filePath = path.join(__dirname, '..', log.recording_url.replace(/^\/uploads\//, 'uploads/'));
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted recording file: ${filePath}`);
          }
        } catch (fileErr) {
          console.warn(`Could not delete recording file: ${fileErr.message}`);
        }
      }
    }

    // 3. Delete all call logs made by this telecaller
    await db.query('DELETE FROM call_logs WHERE telecaller_id = $1', [id]);

    // 4. Delete all session/telemetry records
    await db.query('DELETE FROM telecaller_sessions WHERE telecaller_id = $1', [id]);

    // 5. Unassign their contacts — reset back to pending so they can be re-allotted
    await db.query(
      "UPDATE contacts SET assigned_to = NULL, status = 'pending' WHERE assigned_to = $1",
      [id]
    );

    // 6. Finally delete the user
    await db.query('DELETE FROM users WHERE id = $1', [id]);

    res.json({
      message: `Telecaller '${user.name}' and all their data (${callLogsResult.rows.length} call logs, sessions, contact assignments) deleted successfully.`
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Server error deleting user.' });
  }
};

// Get all telecallers with credentials (Admin only)
exports.getTelecallers = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, plain_password, status, created_at FROM users WHERE role = $1 ORDER BY created_at DESC',
      ['telecaller']
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get telecallers credentials error:', error);
    res.status(500).json({ error: 'Server error fetching telecallers.' });
  }
};

// Delete Company and its isolated SQLite database (Superadmin only)
exports.deleteCompany = async (req, res) => {
  if (req.user.companyRegNum !== null) {
    return res.status(403).json({ error: 'Access forbidden. Only super administrators can delete companies.' });
  }

  const { id } = req.params;
  const fs = require('fs');
  const path = require('path');

  try {
    const compResult = await db.queryMain('SELECT reg_num, name FROM companies WHERE id = $1', [id]);
    if (compResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    const { reg_num, name } = compResult.rows[0];

    // 1. Close cached connection first (to release handles)
    db.closeCompanyConnection(reg_num);

    // 2. Delete SQLite database file
    const dbPath = path.resolve(db.getDatabasesDir(), `company_${reg_num}.sqlite`);
    try {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log(`[Database] Deleted company database file: ${dbPath}`);
      }
    } catch (fileErr) {
      console.warn(`[Database] Could not delete SQLite file: ${fileErr.message}`);
    }

    // 3. Delete from master companies table
    await db.queryMain('DELETE FROM companies WHERE id = $1', [id]);

    res.json({ message: `Company '${name}' and its database deleted successfully.` });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Server error deleting company.' });
  }
};

// Get list of telecallers for a specific company (Superadmin only)
exports.getCompanyTelecallers = async (req, res) => {
  if (req.user.companyRegNum !== null) {
    return res.status(403).json({ error: 'Access forbidden. Only super administrators can access company telecallers.' });
  }

  const { regNum } = req.params;

  try {
    await db.dbStorage.run({ companyRegNum: regNum }, async () => {
      const result = await db.query(
        "SELECT id, name, email, status, created_at FROM users WHERE role = 'telecaller' ORDER BY created_at DESC"
      );
      res.json(result.rows);
    });
  } catch (error) {
    console.error('Get company telecallers error:', error);
    res.status(500).json({ error: 'Server error retrieving company telecallers.' });
  }
};

// Register telecallers in bulk (Admin only) — enforces telecaller cap
exports.registerBulk = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access forbidden. Only administrators can register telecallers.' });
  }

  const { telecallers } = req.body;
  if (!telecallers || !Array.isArray(telecallers) || telecallers.length === 0) {
    return res.status(400).json({ error: 'Please provide an array of telecallers.' });
  }

  const registered = [];
  const errors = [];
  const bcrypt = require('bcryptjs');

  try {
    const currentCount = await db.getCompanyTelecallerCount(req.user.companyRegNum);

    if (req.user.companyRegNum && req.user.companyRegNum.startsWith('EAZ-DEMO-')) {
      if (currentCount + telecallers.length > 3) {
        return res.status(403).json({ error: 'Please purchase any subscription' });
      }
    }

    // Fetch allowed telecaller limit and current count for this company
    let allowedLimit = null;
    let pricePerCaller = 49;
    if (req.user.companyRegNum) {
      const compData = await db.queryMain('SELECT no_of_telecallers, price_per_telecaller, plan_type FROM companies WHERE reg_num = $1', [req.user.companyRegNum]);
      if (compData.rows.length > 0) {
        allowedLimit = compData.rows[0].no_of_telecallers || null;
        pricePerCaller = compData.rows[0].price_per_telecaller || 49;
      }
    }

    let addedCount = 0;
    for (const caller of telecallers) {
      const { name, email } = caller;
      if (!name || !email) {
        errors.push({ email: email || 'unknown', error: 'Missing name or mobile number.' });
        continue;
      }

      // Check if user exists in the active tenant database
      const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (userExists.rows.length > 0) {
        errors.push({ email, error: 'User already exists.' });
        continue;
      }

      // Check if adding would exceed the allowed limit
      if (allowedLimit !== null && (currentCount + addedCount) >= allowedLimit) {
        // Extra telecaller — charge applies
        const compData = await db.queryMain('SELECT plan_type FROM companies WHERE reg_num = $1', [req.user.companyRegNum]);
        const planType = (compData.rows.length > 0 ? compData.rows[0].plan_type : 'monthly') || 'monthly';
        const rate = planType === 'annual' ? 49 * 12 : 59;
        const period = planType === 'annual' ? '/year' : '/month';
        errors.push({ email, error: `Telecaller limit of ${allowedLimit} reached. Adding extra telecallers requires ₹${rate}${period} per seat. Please add individually or update your subscription plan.` });
        continue;
      }

      const defaultPass = 'telecaller_nopassword';
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(defaultPass, salt);

      await db.query(
        'INSERT INTO users (name, email, password_hash, plain_password, role) VALUES ($1, $2, $3, $4, $5)',
        [name, email, passwordHash, defaultPass, 'telecaller']
      );
      registered.push({ name, email });
      addedCount++;
    }

    res.json({
      success: true,
      registeredCount: registered.length,
      registered,
      errors
    });
  } catch (error) {
    console.error('Bulk register error:', error);
    res.status(500).json({ error: 'Server error during bulk registration.' });
  }
};

// Edit telecaller details (Admin only)
exports.editTelecaller = async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access forbidden. Only administrators can edit telecaller profiles.' });
  }

  const { id } = req.params;
  const { name, email } = req.body; // email is mobile number login ID

  if (!name || !email) {
    return res.status(400).json({ error: 'Please provide both name and mobile number.' });
  }

  try {
    // Check if another telecaller has the same mobile number/email in tenant DB
    const duplicate = await db.query('SELECT * FROM users WHERE email = $1 AND id != $2', [email, id]);
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Another user is already registered with this mobile number.' });
    }

    // Update the telecaller in the tenant database
    await db.query(
      'UPDATE users SET name = $1, email = $2 WHERE id = $3',
      [name, email, id]
    );

    // Increment edit_count for the company in master DB
    if (req.user.companyRegNum) {
      await db.queryMain(
        'UPDATE companies SET edit_count = COALESCE(edit_count, 0) + 1 WHERE reg_num = $1',
        [req.user.companyRegNum]
      );
      console.log(`[Database] Incremented edit_count for company: ${req.user.companyRegNum}`);
    }

    res.json({ success: true, message: 'Telecaller details updated successfully.' });
  } catch (error) {
    console.error('Edit telecaller error:', error);
    res.status(500).json({ error: 'Server error during telecaller update.' });
  }
};

// Get company billing details (Admin only)
exports.getCompanyBillingDetails = async (req, res) => {
  if (!req.user.companyRegNum) {
    return res.status(400).json({ error: 'Not a company administrator account.' });
  }

  try {
    const compCheck = await db.queryMain('SELECT name, reg_num, edit_count, no_of_telecallers, plan_type, subscription_start, subscription_end, price_per_telecaller FROM companies WHERE reg_num = $1', [req.user.companyRegNum]);
    if (compCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }
    const company = compCheck.rows[0];

    const telecallersResult = await db.query(
      "SELECT id, name, email, status, created_at FROM users WHERE role = 'telecaller' ORDER BY created_at DESC"
    );

    res.json({
      name: company.name,
      regNum: company.reg_num,
      editCount: company.edit_count || 0,
      noOfTelecallers: company.no_of_telecallers || 0,
      planType: company.plan_type || 'monthly',
      subscriptionStart: company.subscription_start || null,
      subscriptionEnd: company.subscription_end || null,
      pricePerTelecaller: company.price_per_telecaller || 59,
      telecallers: telecallersResult.rows
    });
  } catch (error) {
    console.error('Get company billing details error:', error);
    res.status(500).json({ error: 'Server error retrieving company billing details.' });
  }
};

// Create Razorpay Order (Public) — supports monthly (₹59) and annual (₹49×12) plans
exports.createRazorpayOrder = async (req, res) => {
  const { noOfTelecallers, planType } = req.body;
  if (!noOfTelecallers || isNaN(noOfTelecallers) || parseInt(noOfTelecallers) <= 0) {
    return res.status(400).json({ error: 'Please provide a valid number of telecallers.' });
  }

  const numCallers = parseInt(noOfTelecallers);
  const plan = planType === 'annual' ? 'annual' : 'monthly';
  const MONTHLY_RATE = 59;
  const ANNUAL_RATE = 49;

  // Monthly: ₹59 × callers, Annual: ₹49 × callers × 12
  const totalAmount = plan === 'annual'
    ? numCallers * ANNUAL_RATE * 12
    : numCallers * MONTHLY_RATE;

  const pricePerCaller = plan === 'annual' ? ANNUAL_RATE : MONTHLY_RATE;
  const amountInPaise = totalAmount * 100; // Razorpay expects amount in paise

  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(500).json({ error: 'Razorpay API credentials are not configured on the server.' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    
    console.log(`[Razorpay] Creating ${plan} order for ${numCallers} callers: INR ${totalAmount} (${amountInPaise} paise)`);
    
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Razorpay] Order creation failed:', errorText);
      throw new Error(`Razorpay API responded with status ${response.status}: ${errorText}`);
    }

    const orderData = await response.json();
    console.log(`[Razorpay] Order created successfully: ${orderData.id}`);

    res.json({
      orderId: orderData.id,
      amount: orderData.amount,
      keyId: keyId,
      plan,
      pricePerCaller,
      totalAmount
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({ error: 'Server error creating payment order: ' + error.message });
  }
};

// Create Razorpay Order for Edit Surcharge — ₹20 per edit after 3 free edits (Admin only)
exports.createRazorpayEditOrder = async (req, res) => {
  // Only company admins can call this
  if (!req.user.companyRegNum) {
    return res.status(403).json({ error: 'Only company administrators can pay edit surcharge.' });
  }

  const EDIT_SURCHARGE = 20; // ₹20 per edit after 3 free edits
  const amountInPaise = EDIT_SURCHARGE * 100; // Razorpay expects paise

  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(500).json({ error: 'Razorpay API credentials are not configured on the server.' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    console.log(`[Razorpay] Creating edit surcharge order: INR ${EDIT_SURCHARGE} for company ${req.user.companyRegNum}`);

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `edit_${req.user.companyRegNum}_${Date.now()}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Razorpay] Edit order creation failed:', errorText);
      throw new Error(`Razorpay API responded with status ${response.status}: ${errorText}`);
    }

    const orderData = await response.json();
    console.log(`[Razorpay] Edit surcharge order created: ${orderData.id}`);

    res.json({
      orderId: orderData.id,
      amount: orderData.amount,
      keyId: keyId
    });
  } catch (error) {
    console.error('Create Razorpay edit order error:', error);
    res.status(500).json({ error: 'Server error creating edit payment order: ' + error.message });
  }
};

// Verify Payment and Register Company (Public)
exports.registerCompanyWithPayment = async (req, res) => {
  const { 
    name, nature, noOfTelecallers, email, password, planType,
    razorpay_order_id, razorpay_payment_id, razorpay_signature 
  } = req.body;

  if (!name || !nature || !email || !password || !noOfTelecallers) {
    return res.status(400).json({ error: 'Please provide all required registration fields.' });
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Payment details are missing.' });
  }

  try {
    // 1. Verify Razorpay Signature
    const crypto = require('crypto');
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!keySecret) {
      return res.status(500).json({ error: 'Razorpay credentials not configured.' });
    }

    const signatureText = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(signatureText)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn('[Razorpay] Signature mismatch verification failed!');
      return res.status(400).json({ error: 'Payment verification signature mismatch. Registration aborted.' });
    }

    console.log('[Razorpay] Signature verified successfully. Finalizing registration...');

    // 2. Finalize Registration (Duplicate checks and database provisioning)
    // Check if company admin email already exists in master db companies table
    const companyExists = await db.queryMain('SELECT * FROM companies WHERE admin_email = $1', [email]);
    if (companyExists.rows.length > 0) {
      return res.status(400).json({ error: 'A company with this admin email is already registered.' });
    }

    if (email === 'tellecaller111@eazzio.com') {
      return res.status(400).json({ error: 'This email is reserved for the platform administrator.' });
    }

    // Generate a unique company registration number (e.g. EAZ-123456)
    let isUnique = false;
    let regNum = '';
    while (!isUnique) {
      const rand = Math.floor(100000 + Math.random() * 900000);
      regNum = `EAZ-${rand}`;
      const check = await db.queryMain('SELECT * FROM companies WHERE reg_num = $1', [regNum]);
      if (check.rows.length === 0) {
        isUnique = true;
      }
    }

    // Hash the admin password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const adminPasswordHash = await bcrypt.hash(password, salt);

    const numCallers = parseInt(noOfTelecallers) || 0;
    const plan = planType === 'annual' ? 'annual' : 'monthly';
    const MONTHLY_RATE = 59;
    const ANNUAL_RATE = 49;
    const pricePerCaller = plan === 'annual' ? ANNUAL_RATE : MONTHLY_RATE;

    // Calculate subscription dates
    const now = new Date();
    const subscriptionStart = now.toISOString();
    let subscriptionEnd;
    if (plan === 'annual') {
      const end = new Date(now);
      end.setFullYear(end.getFullYear() + 1);
      subscriptionEnd = end.toISOString();
    } else {
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1);
      subscriptionEnd = end.toISOString();
    }

    // Insert company into master db companies table
    await db.queryMain(
      'INSERT INTO companies (name, nature, no_of_telecallers, reg_num, admin_email, admin_password_hash, admin_plain_password, price_per_telecaller, plan_type, subscription_start, subscription_end, edit_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)',
      [name, nature, numCallers, regNum, email, adminPasswordHash, password, pricePerCaller, plan, subscriptionStart, subscriptionEnd, 0]
    );

    // Provision the isolated database schema for the company
    await db.initializeCompanySchema(regNum, name, email, adminPasswordHash, password);

    res.status(201).json({
      success: true,
      regNum,
      plan,
      subscriptionEnd,
      message: 'Company registered successfully and payment verified! You can now log in.'
    });

  } catch (error) {
    console.error('Verify payment and register error:', error);
    res.status(500).json({ error: 'Server error during payment verification and registration: ' + error.message });
  }
};

// Verify Payment and Renew Company Subscription (Admin only)
exports.renewSubscriptionWithPayment = async (req, res) => {
  if (!req.user || !req.user.companyRegNum) {
    return res.status(403).json({ error: 'Only authenticated company administrators can renew subscriptions.' });
  }

  const { 
    noOfTelecallers, planType,
    razorpay_order_id, razorpay_payment_id, razorpay_signature 
  } = req.body;

  if (!noOfTelecallers || !planType) {
    return res.status(400).json({ error: 'Please provide number of telecallers and plan type.' });
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification details are missing.' });
  }

  try {
    // 1. Verify Razorpay Signature
    const crypto = require('crypto');
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!keySecret) {
      return res.status(500).json({ error: 'Razorpay credentials not configured.' });
    }

    const signatureText = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(signatureText)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn('[Razorpay] Renewal signature mismatch verification failed!');
      return res.status(400).json({ error: 'Payment verification signature mismatch. Renewal aborted.' });
    }

    const numCallers = parseInt(noOfTelecallers) || 0;
    const plan = planType === 'annual' ? 'annual' : 'monthly';
    const MONTHLY_RATE = 59;
    const ANNUAL_RATE = 49;
    const pricePerCaller = plan === 'annual' ? ANNUAL_RATE : MONTHLY_RATE;

    // Calculate subscription dates from now
    const now = new Date();
    const subscriptionStart = now.toISOString();
    let subscriptionEnd;
    if (plan === 'annual') {
      const end = new Date(now);
      end.setFullYear(end.getFullYear() + 1);
      subscriptionEnd = end.toISOString();
    } else {
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1);
      subscriptionEnd = end.toISOString();
    }

    // Update company details in master db companies table
    await db.queryMain(
      'UPDATE companies SET no_of_telecallers = $1, plan_type = $2, price_per_telecaller = $3, subscription_start = $4, subscription_end = $5 WHERE reg_num = $6',
      [numCallers, plan, pricePerCaller, subscriptionStart, subscriptionEnd, req.user.companyRegNum]
    );

    res.json({
      success: true,
      plan,
      subscriptionEnd,
      message: 'Subscription renewed successfully!'
    });

  } catch (error) {
    console.error('Renew subscription error:', error);
    res.status(500).json({ error: 'Server error during subscription renewal: ' + error.message });
  }
};

// Create Razorpay Order for adding 1 extra telecaller seat (Admin only)
exports.createRazorpayExtraTelecallerOrder = async (req, res) => {
  if (!req.user || !req.user.companyRegNum) {
    return res.status(403).json({ error: 'Only authenticated company administrators can add extra telecallers.' });
  }

  try {
    // Check current plan type of company
    const compCheck = await db.queryMain('SELECT plan_type FROM companies WHERE reg_num = $1', [req.user.companyRegNum]);
    if (compCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }
    const company = compCheck.rows[0];
    const plan = company.plan_type || 'monthly';

    // Charge: Monthly is ₹59. Annual is ₹49 * 12 = ₹588
    const totalAmount = plan === 'annual' ? 49 * 12 : 59;
    const amountInPaise = totalAmount * 100;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(500).json({ error: 'Razorpay API credentials are not configured on the server.' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    
    console.log(`[Razorpay] Creating extra telecaller order: INR ${totalAmount} for company ${req.user.companyRegNum}`);

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `extra_${req.user.companyRegNum}_${Date.now()}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Razorpay] Extra telecaller order creation failed:', errorText);
      throw new Error(`Razorpay API responded with status ${response.status}: ${errorText}`);
    }

    const orderData = await response.json();
    res.json({
      orderId: orderData.id,
      amount: orderData.amount,
      keyId: keyId,
      rate: totalAmount
    });

  } catch (error) {
    console.error('Create Razorpay extra telecaller order error:', error);
    res.status(500).json({ error: 'Server error creating extra telecaller payment order: ' + error.message });
  }
};

// Verify payment and add 1 extra telecaller, incrementing company's seat limit (Admin only)
exports.addExtraTelecallerWithPayment = async (req, res) => {
  if (!req.user || !req.user.companyRegNum) {
    return res.status(403).json({ error: 'Only authenticated company administrators can add extra telecallers.' });
  }

  const { 
    name, email, password,
    razorpay_order_id, razorpay_payment_id, razorpay_signature 
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Please provide name and email/mobile number.' });
  }

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Payment details are missing.' });
  }

  try {
    // 1. Verify Razorpay Signature
    const crypto = require('crypto');
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    if (!keySecret) {
      return res.status(500).json({ error: 'Razorpay credentials not configured.' });
    }

    const signatureText = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(signatureText)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.warn('[Razorpay] Extra telecaller signature verification failed!');
      return res.status(400).json({ error: 'Payment verification signature mismatch. Telecaller not registered.' });
    }

    // 2. Register User in tenant database
    const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists with this email/mobile number.' });
    }

    const finalPassword = password || 'telecaller_nopassword';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(finalPassword, salt);

    await db.query(
      'INSERT INTO users (name, email, password_hash, plain_password, role) VALUES ($1, $2, $3, $4, $5)',
      [name, email, passwordHash, finalPassword, 'telecaller']
    );

    // 3. Increment the company's seat limit (no_of_telecallers) in master DB
    await db.queryMain(
      'UPDATE companies SET no_of_telecallers = COALESCE(no_of_telecallers, 0) + 1 WHERE reg_num = $1',
      [req.user.companyRegNum]
    );

    res.status(201).json({
      success: true,
      message: 'Payment verified and extra telecaller registered successfully. Limit increased by 1 seat.'
    });

  } catch (error) {
    console.error('Add extra telecaller error:', error);
    res.status(500).json({ error: 'Server error during extra telecaller registration: ' + error.message });
  }
};
