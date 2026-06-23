const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_eazzio_telecaller_system_2026';

// Register User
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

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(finalPassword, salt);

    await db.query(
      'INSERT INTO users (name, email, password_hash, plain_password, role) VALUES ($1, $2, $3, $4, $5)',
      [name, email, passwordHash, finalPassword, userRole]
    );

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
};

// Login User
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Please provide email or mobile number.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email/mobile number or password.' });
    }

    const user = result.rows[0];

    // If role is telecaller, bypass password check
    if (user.role !== 'telecaller') {
      if (!password) {
        return res.status(400).json({ error: 'Please provide password.' });
      }
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email/mobile number or password.' });
      }
    }

    // Update status to online
    await db.query('UPDATE users SET status = $1, last_active_at = CURRENT_TIMESTAMP WHERE id = $2', ['online', user.id]);

    // Create notification if telecaller went online
    if (user.role === 'telecaller') {
      try {
        await db.query(
          'INSERT INTO admin_notifications (message) VALUES ($1)',
          [`Telecaller ${user.name} went online`]
        );
      } catch (err) {
        console.error('Error logging online notification:', err);
      }
    }

    // If telecaller, ensure session exists for today
    if (user.role === 'telecaller') {
      const today = new Date().toISOString().split('T')[0];
      const sessionCheck = await db.query(
        'SELECT * FROM telecaller_sessions WHERE telecaller_id = $1 AND date = $2',
        [user.id, today]
      );
      if (sessionCheck.rows.length === 0) {
        await db.query(
          'INSERT INTO telecaller_sessions (telecaller_id, date) VALUES ($1, $2)',
          [user.id, today]
        );
      }
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: 'online'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
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
    res.json(result.rows[0]);
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
