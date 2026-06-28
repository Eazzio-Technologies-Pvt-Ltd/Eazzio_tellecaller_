const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const nodemailer = require('nodemailer');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_eazzio_telecaller_system_2026';

const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '587', 10) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    // Helpful to circumvent handshake or self-signed cert issues on various servers
    rejectUnauthorized: false
  }
});


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
        if (currentCount >= 1) {
          return res.status(403).json({
            error: 'please take subscription'
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
      [name, nature, numCallers, regNum, email, adminPasswordHash, password, 59]
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
  const { name, email, password, macAddress, companyName: inputCompanyName, nature: inputNature } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Please provide both name and email.' });
  }

  try {
    // Check if company admin email already exists in master db companies table
    const companyExists = await db.queryMain('SELECT * FROM companies WHERE admin_email = $1', [email]);
    if (companyExists.rows.length > 0) {
      return res.status(400).json({ error: 'A company with this admin email is already registered.' });
    }

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

    const companyName = inputCompanyName || `${name}'s Demo Company`;
    const companyNature = inputNature || 'Demo Workspace';
    const defaultPassword = password || 'demopassword123';
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
      [companyName, companyNature, 1, regNum, email, adminPasswordHash, defaultPassword, 0, formattedExpiry, 'demo', macAddress || null]
    );

    // Provision the isolated database schema
    await db.initializeCompanySchema(regNum, companyName, email, adminPasswordHash, defaultPassword);

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
    const companiesResult = await db.queryMain('SELECT reg_num, edit_count, plan_type, no_of_telecallers, call_recording_enabled, call_recording_end_date FROM companies');
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
      if (plan === 'demo') {
        subscriptionCharge = 0;
      } else if (plan === 'annual') {
        subscriptionCharge = seats * 49 * 12;
      } else {
        subscriptionCharge = seats * 59;
      }
      totalCharge += subscriptionCharge;

      const edits = comp.edit_count || 0;
      const editCharge = Math.max(0, edits - 3) * 20;
      totalCharge += editCharge;

      // Add call recording add-on charge if active
      if (comp.call_recording_enabled === 1 && comp.call_recording_end_date) {
        const now = new Date();
        let expiryStr = comp.call_recording_end_date.toString();
        if (!expiryStr.includes('Z') && !expiryStr.includes('T')) {
          expiryStr = expiryStr.replace(' ', 'T') + 'Z';
        }
        const expiry = new Date(expiryStr);
        if (expiry >= now) {
          totalCharge += plan === 'annual' ? 399 : 49;
        }
      }
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
    const regNum = req.user.companyRegNum;
    let result;
    
    await db.dbStorage.run({ companyRegNum: regNum }, async () => {
      result = await db.query('SELECT id, name, email, role, status FROM users WHERE id = $1', [req.user.id]);
    });

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = result.rows[0];
    user.companyRegNum = regNum !== undefined ? regNum : null;

    if (regNum) {
      const compRes = await db.queryMain('SELECT edit_count, subscription_end, plan_type, no_of_telecallers, call_recording_enabled, call_recording_end_date FROM companies WHERE reg_num = $1', [regNum]);
      if (compRes.rows.length > 0) {
        user.editCount = compRes.rows[0].edit_count || 0;
        user.subscriptionEnd = compRes.rows[0].subscription_end || null;
        user.planType = compRes.rows[0].plan_type || 'monthly';
        user.noOfTelecallers = compRes.rows[0].no_of_telecallers || 0;
        user.callRecordingEndDate = compRes.rows[0].call_recording_end_date || null;
        
        user.callRecordingEnabled = false;
        if (compRes.rows[0].call_recording_enabled === 1 && user.callRecordingEndDate) {
          const now = new Date();
          let expiryStr = user.callRecordingEndDate.toString();
          if (!expiryStr.includes('Z') && !expiryStr.includes('T')) {
            expiryStr = expiryStr.replace(' ', 'T') + 'Z';
          }
          const expiry = new Date(expiryStr);
          if (expiry >= now) {
            user.callRecordingEnabled = true;
          }
        }
      } else {
        user.editCount = 0;
        user.subscriptionEnd = null;
        user.planType = 'monthly';
        user.noOfTelecallers = 0;
        user.callRecordingEnabled = false;
        user.callRecordingEndDate = null;
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
      const result = await db.query(`
        SELECT 
          u.id, 
          u.name, 
          u.email, 
          u.status, 
          u.created_at,
          COALESCE(cl.connected_count, 0) as connected_count,
          COALESCE(cl.non_connected_count, 0) as non_connected_count,
          COALESCE(cl.received_count, 0) as received_count,
          COALESCE(cl.missed_count, 0) as missed_count
        FROM users u
        LEFT JOIN (
          SELECT 
            telecaller_id,
            COUNT(CASE WHEN call_status = 'connected' THEN 1 END) as connected_count,
            COUNT(CASE WHEN call_status = 'non-connected' THEN 1 END) as non_connected_count,
            COUNT(CASE WHEN call_status = 'received' THEN 1 END) as received_count,
            COUNT(CASE WHEN call_status = 'missed' THEN 1 END) as missed_count
          FROM call_logs
          WHERE ${db.dbType === 'postgres' ? 'called_at::date = CURRENT_DATE' : "date(called_at) = CURRENT_DATE"}
          GROUP BY telecaller_id
        ) cl ON u.id = cl.telecaller_id
        WHERE u.role = 'telecaller'
        ORDER BY u.created_at DESC
      `);
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
      if (currentCount + telecallers.length > 1) {
        return res.status(403).json({ error: 'please take subscription' });
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
    const compCheck = await db.queryMain('SELECT name, reg_num, edit_count, no_of_telecallers, plan_type, subscription_start, subscription_end, price_per_telecaller, call_recording_enabled, call_recording_end_date FROM companies WHERE reg_num = $1', [req.user.companyRegNum]);
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
      pricePerTelecaller: company.plan_type === 'demo' ? 0 : (company.plan_type === 'annual' ? 49 : 59),
      callRecordingEnabled: company.call_recording_enabled === 1,
      callRecordingEndDate: company.call_recording_end_date || null,
      telecallers: telecallersResult.rows
    });
  } catch (error) {
    console.error('Get company billing details error:', error);
    res.status(500).json({ error: 'Server error retrieving company billing details.' });
  }
};

// Create Razorpay Order (Public) — supports monthly (₹59) and annual (₹49×12) plans
exports.createRazorpayOrder = async (req, res) => {
  const { noOfTelecallers, planType, includeCallRecording } = req.body;
  if (!noOfTelecallers || isNaN(noOfTelecallers) || parseInt(noOfTelecallers) <= 0) {
    return res.status(400).json({ error: 'Please provide a valid number of telecallers.' });
  }

  const numCallers = parseInt(noOfTelecallers);
  const plan = planType === 'annual' ? 'annual' : 'monthly';
  const MONTHLY_RATE = 59;
  const ANNUAL_RATE = 49;

  // Monthly: ₹59 × callers, Annual: ₹49 × callers × 12
  let totalAmount = plan === 'annual'
    ? numCallers * ANNUAL_RATE * 12
    : numCallers * MONTHLY_RATE;

  let recordingCharge = 0;
  if (includeCallRecording) {
    recordingCharge = plan === 'annual' ? 399 : 49;
    totalAmount += recordingCharge;
  }

  const pricePerCaller = plan === 'annual' ? ANNUAL_RATE : MONTHLY_RATE;
  const amountInPaise = totalAmount * 100; // Razorpay expects amount in paise

  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(500).json({ error: 'Razorpay API credentials are not configured on the server.' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    
    console.log(`[Razorpay] Creating ${plan} order for ${numCallers} callers (Call Recording: ${includeCallRecording ? 'Yes' : 'No'}): INR ${totalAmount} (${amountInPaise} paise)`);
    
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
    name, nature, noOfTelecallers, email, password, planType, includeCallRecording,
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
      'INSERT INTO companies (name, nature, no_of_telecallers, reg_num, admin_email, admin_password_hash, admin_plain_password, price_per_telecaller, plan_type, subscription_start, subscription_end, edit_count, call_recording_enabled, call_recording_end_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)',
      [name, nature, numCallers, regNum, email, adminPasswordHash, password, pricePerCaller, plan, subscriptionStart, subscriptionEnd, 0, includeCallRecording ? 1 : 0, includeCallRecording ? subscriptionEnd : null]
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
    noOfTelecallers, planType, includeCallRecording,
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

    const oldRegNum = req.user.companyRegNum;
    const isDemo = oldRegNum.startsWith('EAZ-DEMO-');
    let finalRegNum = oldRegNum;

    // 2. If upgrading from demo, generate a new normal registration number and rename the database
    if (isDemo) {
      let isUnique = false;
      while (!isUnique) {
        const rand = Math.floor(100000 + Math.random() * 900000);
        finalRegNum = `EAZ-${rand}`;
        const check = await db.queryMain('SELECT * FROM companies WHERE reg_num = $1', [finalRegNum]);
        if (check.rows.length === 0) {
          isUnique = true;
        }
      }

      // Rename the SQLite database file (demo → normal)
      if (db.dbType === 'sqlite') {
        const pathModule = require('path');
        const fs = require('fs');
        const databasesDir = db.getDatabasesDir();
        const oldFile = pathModule.join(databasesDir, `company_${oldRegNum}.sqlite`);
        const newFile = pathModule.join(databasesDir, `company_${finalRegNum}.sqlite`);
        if (fs.existsSync(oldFile)) {
          db.closeCompanyConnection(oldRegNum);
          fs.renameSync(oldFile, newFile);
          console.log(`[Database] Renamed company database from ${oldRegNum} to ${finalRegNum}`);
        }
      } else if (db.dbType === 'postgres') {
        const oldSchema = `company_${oldRegNum}`;
        const newSchema = `company_${finalRegNum}`;
        const client = await db.pgPool.connect();
        try {
          await client.query(`ALTER SCHEMA "${oldSchema}" RENAME TO "${newSchema}"`);
          console.log(`[Database] Renamed PostgreSQL schema from ${oldSchema} to ${newSchema}`);
        } finally {
          client.release();
        }
      }

      // Update company in master DB — change reg_num + plan data in one query
      await db.queryMain(
        `UPDATE companies
         SET reg_num = $1,
             no_of_telecallers = $2,
             plan_type = $3,
             price_per_telecaller = $4,
             subscription_start = $5,
             subscription_end = $6,
             call_recording_enabled = CASE WHEN $7 = 1 THEN 1 ELSE call_recording_enabled END,
             call_recording_end_date = CASE WHEN $7 = 1 THEN $6 ELSE call_recording_end_date END
         WHERE reg_num = $8`,
        [finalRegNum, numCallers, plan, pricePerCaller, subscriptionStart, subscriptionEnd, includeCallRecording ? 1 : 0, oldRegNum]
      );

      // Update support tickets with the new company registration code
      try {
        await db.queryMain(
          'UPDATE support_tickets SET company_reg_num = $1 WHERE company_reg_num = $2',
          [finalRegNum, oldRegNum]
        );
      } catch (ticketErr) {
        console.error('Error updating support tickets registration number:', ticketErr);
      }
    } else {
      // Regular renewal — just update plan data
      await db.queryMain(
        `UPDATE companies
         SET no_of_telecallers = $1,
             plan_type = $2,
             price_per_telecaller = $3,
             subscription_start = $4,
             subscription_end = $5,
             call_recording_enabled = CASE WHEN $6 = 1 THEN 1 ELSE call_recording_enabled END,
             call_recording_end_date = CASE WHEN $6 = 1 THEN $5 ELSE call_recording_end_date END
         WHERE reg_num = $7`,
        [numCallers, plan, pricePerCaller, subscriptionStart, subscriptionEnd, includeCallRecording ? 1 : 0, oldRegNum]
      );
    }

    // 3. Issue a new JWT token (with updated companyRegNum if demo was upgraded)
    const newToken = jwt.sign(
      {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        companyRegNum: finalRegNum
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      plan,
      subscriptionEnd,
      newRegNum: finalRegNum,
      token: newToken,
      message: isDemo
        ? `Demo account successfully upgraded! Your new registration code is ${finalRegNum}.`
        : 'Subscription renewed successfully!'
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

// Toggle Call Recording for a company (superadmin can toggle any company, company admin toggles own company)
exports.toggleCallRecording = async (req, res) => {
  try {
    const { regNum, enabled } = req.body;

    // Company admin can only toggle their own company
    let targetRegNum = req.user.companyRegNum || regNum;

    if (!targetRegNum) {
      return res.status(400).json({ error: 'Company registration number is required.' });
    }

    // Verify company exists
    const compCheck = await db.queryMain('SELECT reg_num, call_recording_enabled, call_recording_end_date FROM companies WHERE reg_num = $1', [targetRegNum]);
    if (compCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    // If company admin is trying to toggle ON, verify their subscription is active
    if (req.user.companyRegNum && enabled) {
      const company = compCheck.rows[0];
      const endDate = company.call_recording_end_date;
      if (!endDate) {
        return res.status(403).json({ error: 'You must pay to activate the Call Recording subscription.' });
      }
      
      const now = new Date();
      let expiryStr = endDate.toString();
      if (!expiryStr.includes('Z') && !expiryStr.includes('T')) {
        expiryStr = expiryStr.replace(' ', 'T') + 'Z';
      }
      const expiry = new Date(expiryStr);
      if (expiry < now) {
        return res.status(403).json({ error: 'Your Call Recording subscription has expired. Please visit the Billing page to renew.' });
      }
    }

    const newValue = enabled ? 1 : 0;
    await db.queryMain(
      'UPDATE companies SET call_recording_enabled = $1 WHERE reg_num = $2',
      [newValue, targetRegNum]
    );

    res.json({
      success: true,
      callRecordingEnabled: enabled,
      message: enabled
        ? 'Call recording has been enabled for this company.'
        : 'Call recording has been disabled for this company.'
    });
  } catch (error) {
    console.error('Toggle call recording error:', error);
    res.status(500).json({ error: 'Server error toggling call recording.' });
  }
};

// Create Razorpay Order specifically for Call Recording Add-on (Admin only)
exports.createCallRecordingOrder = async (req, res) => {
  if (!req.user || !req.user.companyRegNum) {
    return res.status(403).json({ error: 'Only authenticated company administrators can purchase call recording.' });
  }

  try {
    // Check current plan type of company
    const compCheck = await db.queryMain('SELECT plan_type FROM companies WHERE reg_num = $1', [req.user.companyRegNum]);
    if (compCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }
    const company = compCheck.rows[0];
    const plan = company.plan_type || 'monthly';

    // Charge: Monthly is ₹49. Annual is ₹399
    const totalAmount = plan === 'annual' ? 399 : 49;
    const amountInPaise = totalAmount * 100;

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return res.status(500).json({ error: 'Razorpay API credentials are not configured.' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    
    console.log(`[Razorpay] Creating call recording add-on order for ${req.user.companyRegNum}: INR ${totalAmount} (${amountInPaise} paise)`);
    
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rec_rec_${Date.now()}`
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Razorpay responded with status ${response.status}: ${errorText}`);
    }

    const orderData = await response.json();
    res.json({
      orderId: orderData.id,
      amount: orderData.amount,
      keyId: keyId,
      plan,
      totalAmount
    });
  } catch (error) {
    console.error('Create call recording order error:', error);
    res.status(500).json({ error: 'Server error creating payment order: ' + error.message });
  }
};

// Verify payment and enable call recording (Admin only)
exports.enableCallRecordingWithPayment = async (req, res) => {
  if (!req.user || !req.user.companyRegNum) {
    return res.status(403).json({ error: 'Only authenticated company administrators can verify call recording payments.' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification details are missing.' });
  }

  try {
    // 1. Verify Signature
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
      console.warn('[Razorpay] Signature mismatch for call recording payment!');
      return res.status(400).json({ error: 'Payment verification signature mismatch.' });
    }

    // 2. Fetch company plan type to calculate expiry date
    const compCheck = await db.queryMain('SELECT plan_type, call_recording_end_date FROM companies WHERE reg_num = $1', [req.user.companyRegNum]);
    if (compCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }
    const company = compCheck.rows[0];
    const plan = company.plan_type || 'monthly';

    // Extend recording date starting from now or from the previous end date if still active
    const now = new Date();
    let startDate = now;
    if (company.call_recording_end_date) {
      let currentExpiryStr = company.call_recording_end_date.toString();
      if (!currentExpiryStr.includes('Z') && !currentExpiryStr.includes('T')) {
        currentExpiryStr = currentExpiryStr.replace(' ', 'T') + 'Z';
      }
      const currentExpiry = new Date(currentExpiryStr);
      if (currentExpiry > now) {
        startDate = currentExpiry;
      }
    }

    let endDate = new Date(startDate);
    if (plan === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    const callRecordingEndDate = endDate.toISOString();

    // 3. Update DB
    await db.queryMain(
      'UPDATE companies SET call_recording_enabled = 1, call_recording_end_date = $1 WHERE reg_num = $2',
      [callRecordingEndDate, req.user.companyRegNum]
    );

    res.json({
      success: true,
      callRecordingEnabled: true,
      callRecordingEndDate,
      message: 'Call recording payment verified and activated successfully!'
    });
  } catch (error) {
    console.error('Verify call recording payment error:', error);
    res.status(500).json({ error: 'Server error during call recording activation: ' + error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Please provide email address.' });
  }

  try {
    // 1. Check if email is superadmin or company admin
    const superadminCheck = await db.queryMain('SELECT * FROM users WHERE email = $1', [email]);
    const companyCheck = await db.queryMain('SELECT * FROM companies WHERE admin_email = $1', [email]);

    if (superadminCheck.rows.length === 0 && companyCheck.rows.length === 0) {
      return res.status(400).json({ error: 'No admin or partner account found with this email address.' });
    }

    // 2. Generate 6-digit verification code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // 3. Clear existing requests and save
    await db.queryMain('DELETE FROM password_resets WHERE email = $1', [email]);
    await db.queryMain(
      'INSERT INTO password_resets (email, otp, expires_at, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [email, otp, expiresAt.toISOString()]
    );

    // 4. Send email
    const fromEmail = process.env.FROM_EMAIL || 'eazziogroup@gmail.com';
    const mailOptions = {
      from: `"Eazzio Support" <${fromEmail}>`,
      to: email,
      subject: 'Eazzio Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <h2 style="color: #6366F1; text-align: center;">Eazzio Password Reset</h2>
          <p>You requested to reset your password. Use the following verification code to complete the request:</p>
          <div style="font-size: 24px; font-weight: bold; background-color: #F3F4F6; padding: 15px; margin: 20px 0; text-align: center; border-radius: 8px; letter-spacing: 6px; color: #4F46E5;">
            ${otp}
          </div>
          <p>This verification code is valid for 15 minutes. If you did not make this request, please ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b; text-align: center;">Regards,<br/>Team Eazzio Technologies Pvt Ltd</p>
        </div>
      `
    };

    await mailTransporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Verification OTP sent to your registered email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error while sending reset OTP: ' + error.message });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Please provide email, verification code, and new password.' });
  }

  try {
    // 1. Verify OTP
    const resetRes = await db.queryMain('SELECT * FROM password_resets WHERE email = $1 AND otp = $2 ORDER BY id DESC LIMIT 1', [email, otp]);
    if (resetRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or incorrect verification code.' });
    }

    const resetRecord = resetRes.rows[0];
    const expiresAt = new Date(resetRecord.expires_at);
    if (expiresAt < new Date()) {
      return res.status(400).json({ error: 'The verification code has expired. Please request a new one.' });
    }

    // 2. Hash and update password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    if (email === 'tellecaller111@eazzio.com') {
      await db.queryMain('UPDATE users SET password_hash = $1, plain_password = $2 WHERE email = $3', [passwordHash, newPassword, email]);
    } else {
      // Company Admin
      // Update master database companies table
      await db.queryMain('UPDATE companies SET admin_password_hash = $1, admin_plain_password = $2 WHERE admin_email = $3', [passwordHash, newPassword, email]);
      
      // Update tenant database users table (where role = admin)
      const compCheck = await db.queryMain('SELECT reg_num FROM companies WHERE admin_email = $1', [email]);
      if (compCheck.rows.length > 0) {
        const regNum = compCheck.rows[0].reg_num;
        await db.dbStorage.run({ companyRegNum: regNum }, async () => {
          await db.query("UPDATE users SET password_hash = $1, plain_password = $2 WHERE role = 'admin'", [passwordHash, newPassword]);
        });
      }
    }

    // 3. Clear reset token
    await db.queryMain('DELETE FROM password_resets WHERE email = $1', [email]);

    res.json({ success: true, message: 'Password reset successfully. You can now login with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error while resetting password: ' + error.message });
  }
};

