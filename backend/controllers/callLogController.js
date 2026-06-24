const db = require('../config/database');

// Create call log & upload call recording
exports.createCallLog = async (req, res) => {
  const { contactId, callStatus, duration, feedback, followUpDate } = req.body;
  const userId = req.user.id;

  if (!contactId || !callStatus) {
    return res.status(400).json({ error: 'Contact ID and Call Status are required.' });
  }

  try {
    let recordingUrl = null;
    if (req.file) {
      recordingUrl = `/uploads/recordings/${req.file.filename}`;
    }

    // 1. Insert call log
    await db.query(
      `INSERT INTO call_logs (contact_id, telecaller_id, call_status, duration, feedback, recording_url) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [contactId, userId, callStatus, parseInt(duration || 0), feedback || '', recordingUrl]
    );

    // 2. Update contact status & follow up date
    let contactStatus = 'completed';
    if (callStatus === 'missed') {
      contactStatus = 'missed';
    }
    
    let updateSql = 'UPDATE contacts SET status = $1, last_called_at = CURRENT_TIMESTAMP';
    const params = [contactStatus];
    let paramIndex = 2;

    if (followUpDate && followUpDate !== 'null' && followUpDate !== '') {
      updateSql += `, follow_up_date = $${paramIndex}`;
      params.push(new Date(followUpDate));
      paramIndex++;
      // If there is a follow_up_date, the contact goes into 'follow_up' status instead of completed/missed
      params[0] = 'follow_up';
    }

    updateSql += ` WHERE id = $${paramIndex}`;
    params.push(contactId);

    await db.query(updateSql, params);

    // 3. Increment talk time in today's telecaller session
    const today = new Date().toISOString().split('T')[0];
    await db.query(
      `UPDATE telecaller_sessions 
       SET total_calling_time = total_calling_time + $1, last_updated_at = CURRENT_TIMESTAMP 
       WHERE telecaller_id = $2 AND date = $3`,
      [parseInt(duration || 0), userId, today]
    );

    res.status(201).json({ message: 'Call log saved and contact updated successfully.' });
  } catch (error) {
    console.error('Create call log error:', error);
    res.status(500).json({ error: 'Server error saving call log.' });
  }
};

// Sync Telemetry session timers (working time, idle time, break time)
exports.syncTelemetry = async (req, res) => {
  const { workingTime, idleTime, breakTime, callingTime } = req.body;
  const userId = req.user.id;
  const today = new Date().toISOString().split('T')[0];

  try {
    const sessionCheck = await db.query(
      'SELECT * FROM telecaller_sessions WHERE telecaller_id = $1 AND date = $2',
      [userId, today]
    );

    if (sessionCheck.rows.length === 0) {
      try {
        await db.query(
          `INSERT INTO telecaller_sessions (telecaller_id, date, total_working_time, total_idle_time, total_break_time, total_calling_time) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, today, workingTime || 0, idleTime || 0, breakTime || 0, callingTime || 0]
        );
      } catch (insertErr) {
        await db.query(
          `UPDATE telecaller_sessions 
           SET total_working_time = $1, total_idle_time = $2, total_break_time = $3, total_calling_time = $4, last_updated_at = CURRENT_TIMESTAMP
           WHERE telecaller_id = $5 AND date = $6`,
          [workingTime || 0, idleTime || 0, breakTime || 0, callingTime || 0, userId, today]
        );
      }
    } else {
      await db.query(
        `UPDATE telecaller_sessions 
         SET total_working_time = $1, total_idle_time = $2, total_break_time = $3, total_calling_time = $4, last_updated_at = CURRENT_TIMESTAMP
         WHERE telecaller_id = $5 AND date = $6`,
        [workingTime || 0, idleTime || 0, breakTime || 0, callingTime || 0, userId, today]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Sync telemetry error:', error);
    res.status(500).json({ error: 'Server error syncing telemetry.' });
  }
};

// Fetch call logs for Admin (filters: user, search, dates)
exports.getCallLogs = async (req, res) => {
  try {
    const { telecallerId } = req.query;
    const parsedId = telecallerId ? parseInt(telecallerId, 10) : null;

    let queryText = `
      SELECT 
        cl.*,
        c.name as contact_name,
        c.phone_number as contact_phone,
        u.name as telecaller_name,
        camp.name as campaign_name
      FROM call_logs cl
      JOIN contacts c ON cl.contact_id = c.id
      JOIN users u ON cl.telecaller_id = u.id
      JOIN campaigns camp ON c.campaign_id = camp.id
    `;
    const params = [];
    if (parsedId) {
      queryText += ` WHERE cl.telecaller_id = $1`;
      params.push(parsedId);
    }
    queryText += ` ORDER BY cl.called_at DESC LIMIT 500`;

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get call logs error:', error);
    res.status(500).json({ error: 'Server error fetching call logs.' });
  }
};

// Get Dashboard Analytics
exports.getAnalytics = async (req, res) => {
  try {
    const { telecallerId } = req.query;
    const parsedId = telecallerId ? parseInt(telecallerId, 10) : null;

    let overview;
    let campaigns;
    let callTrend;

    if (parsedId) {
      overview = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM contacts WHERE assigned_to = $1) as total_contacts,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'connected' AND telecaller_id = $2) as connected_calls,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'missed' AND telecaller_id = $3) as missed_calls,
          (SELECT SUM(duration) FROM call_logs WHERE telecaller_id = $4) as total_talk_time
      `, [parsedId, parsedId, parsedId, parsedId]);

      campaigns = await db.query(`
        SELECT c.status, COUNT(DISTINCT c.id) as count 
        FROM campaigns c 
        JOIN contacts con ON con.campaign_id = c.id 
        WHERE con.assigned_to = $1 
        GROUP BY c.status
      `, [parsedId]);

      const isPg = db.dbType === 'postgres';
      const dateGrouping = isPg ? "TO_CHAR(called_at, 'YYYY-MM-DD')" : "date(called_at)";
      
      callTrend = await db.query(`
        SELECT 
          ${dateGrouping} as call_date,
          COUNT(CASE WHEN call_status = 'connected' THEN 1 END) as connected,
          COUNT(CASE WHEN call_status = 'missed' THEN 1 END) as missed
        FROM call_logs
        WHERE telecaller_id = $1
        GROUP BY call_date
        ORDER BY call_date ASC
        LIMIT 7
      `, [parsedId]);
    } else {
      overview = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM contacts) as total_contacts,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'connected') as connected_calls,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'missed') as missed_calls,
          (SELECT SUM(duration) FROM call_logs) as total_talk_time
      `);

      campaigns = await db.query(`
        SELECT status, COUNT(*) as count FROM campaigns GROUP BY status
      `);

      const isPg = db.dbType === 'postgres';
      const dateGrouping = isPg ? "TO_CHAR(called_at, 'YYYY-MM-DD')" : "date(called_at)";
      
      callTrend = await db.query(`
        SELECT 
          ${dateGrouping} as call_date,
          COUNT(CASE WHEN call_status = 'connected' THEN 1 END) as connected,
          COUNT(CASE WHEN call_status = 'missed' THEN 1 END) as missed
        FROM call_logs
        GROUP BY call_date
        ORDER BY call_date ASC
        LIMIT 7
      `);
    }

    // 3. Active telecaller session metrics (always global for leaderboard & dropdown selector)
    const callers = await db.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.status,
        COALESCE(ts.working_time, 0) as working_time,
        COALESCE(ts.calling_time, 0) as calling_time,
        COALESCE(ts.idle_time, 0) as idle_time,
        COALESCE(ts.break_time, 0) as break_time
      FROM users u
      LEFT JOIN (
        SELECT 
          telecaller_id,
          MAX(total_working_time) as working_time,
          MAX(total_calling_time) as calling_time,
          MAX(total_idle_time) as idle_time,
          MAX(total_break_time) as break_time
        FROM telecaller_sessions
        WHERE date = CURRENT_DATE
        GROUP BY telecaller_id
      ) ts ON u.id = ts.telecaller_id
      WHERE u.role = 'telecaller'
    `);

    res.json({
      overview: overview.rows[0],
      campaigns: campaigns.rows,
      callers: callers.rows,
      callTrend: callTrend.rows,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Server error fetching analytics.' });
  }
};
