const db = require('../config/database');

function getTrackingDate(dateInput) {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = dateInput ? new Date(dateInput) : new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const partMap = {};
  parts.forEach(p => partMap[p.type] = p.value);
  const year = parseInt(partMap.year, 10);
  const month = parseInt(partMap.month, 10);
  const day = parseInt(partMap.day, 10);
  const hour = parseInt(partMap.hour, 10);
  let istDate = new Date(Date.UTC(year, month - 1, day, hour));
  if (hour < 12) {
    istDate.setUTCDate(istDate.getUTCDate() - 1);
  }
  const targetYear = istDate.getUTCFullYear();
  const targetMonth = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const targetDay = String(istDate.getUTCDate()).padStart(2, '0');
  return `${targetYear}-${targetMonth}-${targetDay}`;
}

// Create call log & upload call recording
exports.createCallLog = async (req, res) => {
  const { contactId, callStatus, duration, feedback, followUpDate, calledAt } = req.body;
  const userId = req.user.id;

  if (!contactId || !callStatus) {
    return res.status(400).json({ error: 'Contact ID and Call Status are required.' });
  }

  try {
    // 1. Duplicate check based on contactId and calledAt (within a 5-second window)
    if (calledAt) {
      const targetTime = new Date(calledAt).getTime();
      const existingLogs = await db.query(
        'SELECT id, called_at FROM call_logs WHERE contact_id = $1',
        [contactId]
      );
      
      let isDuplicate = false;
      for (const log of existingLogs.rows) {
        const logTime = new Date(log.called_at).getTime();
        if (Math.abs(logTime - targetTime) < 5000) {
          isDuplicate = true;
          break;
        }
      }
      
      if (isDuplicate) {
        return res.status(200).json({ message: 'Call log already synced.' });
      }
    }

    // Check if call recording is enabled for company and subscription is active
    let hasRecording = false;
    if (req.user && req.user.companyRegNum) {
      const compCheck = await db.queryMain(
        'SELECT call_recording_enabled, call_recording_end_date FROM companies WHERE reg_num = $1',
        [req.user.companyRegNum]
      );
      if (compCheck.rows.length > 0 && compCheck.rows[0].call_recording_enabled === 1) {
        const endDate = compCheck.rows[0].call_recording_end_date;
        if (endDate) {
          const now = new Date();
          const expiry = db.parseSafeDate(endDate);
          if (expiry && expiry >= now) {
            hasRecording = true;
          }
        }
      }
    }

    let recordingUrl = null;
    if (req.file) {
      if (hasRecording) {
        recordingUrl = `/uploads/recordings/${req.file.filename}`;
      } else {
        // Delete the file since it's not paid for
        const fs = require('fs');
        fs.unlink(req.file.path, (err) => {
          if (err) console.error('Error deleting unauthorized recording file:', err.message);
        });
      }
    }

    const insertTime = calledAt ? new Date(calledAt) : new Date();

    // 2. Insert call log
    await db.query(
      `INSERT INTO call_logs (contact_id, telecaller_id, call_status, duration, feedback, recording_url, called_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [contactId, userId, callStatus, parseInt(duration || 0), feedback || '', recordingUrl, insertTime]
    );

    // 3. Update contact status & follow up date
    let contactStatus = 'completed';
    if (callStatus === 'missed' || callStatus === 'non-connected') {
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

    if (params[0] === 'follow_up') {
      updateSql += ', follow_up_started_at = COALESCE(follow_up_started_at, CURRENT_TIMESTAMP)';
    } else {
      updateSql += ', follow_up_started_at = NULL';
    }

    updateSql += ` WHERE id = $${paramIndex}`;
    params.push(contactId);

    await db.query(updateSql, params);

    // 4. Increment talk time in the call log's day telecaller session
    const sessionDate = getTrackingDate(calledAt);
    const sessionCheck = await db.query(
      'SELECT id FROM telecaller_sessions WHERE telecaller_id = $1 AND date = $2',
      [userId, sessionDate]
    );
    if (sessionCheck.rows.length === 0) {
      try {
        await db.query(
          `INSERT INTO telecaller_sessions (telecaller_id, date, total_calling_time) 
           VALUES ($1, $2, $3)`,
          [userId, sessionDate, parseInt(duration || 0)]
        );
      } catch (insertErr) {
        await db.query(
          `UPDATE telecaller_sessions 
           SET total_calling_time = total_calling_time + $1, last_updated_at = CURRENT_TIMESTAMP 
           WHERE telecaller_id = $2 AND date = $3`,
          [parseInt(duration || 0), userId, sessionDate]
        );
      }
    } else {
      await db.query(
        `UPDATE telecaller_sessions 
         SET total_calling_time = total_calling_time + $1, last_updated_at = CURRENT_TIMESTAMP 
         WHERE telecaller_id = $2 AND date = $3`,
        [parseInt(duration || 0), userId, sessionDate]
      );
    }

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
  const today = getTrackingDate();

  try {
    // Update user's last active timestamp because they just synced telemetry.
    // If they were marked offline (due to background check inactivity), mark them back online.
    const userCheck = await db.query('SELECT status, name FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length > 0) {
      const user = userCheck.rows[0];
      if (user.status === 'offline') {
        await db.query(
          'UPDATE users SET status = $1, last_active_at = CURRENT_TIMESTAMP WHERE id = $2',
          ['online', userId]
        );
        // Log online notification
        try {
          const notificationController = require('./notificationController');
          await notificationController.createNotification(
            `Telecaller ${user.name} went online`,
            req.user.companyRegNum
          );
        } catch (err) {
          console.error('Error logging status transition notification in telemetry sync:', err);
        }
      } else {
        await db.query(
          'UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1',
          [userId]
        );
      }
    }

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
        const checkAgain = await db.query(
          'SELECT * FROM telecaller_sessions WHERE telecaller_id = $1 AND date = $2',
          [userId, today]
        );
        const current = checkAgain.rows[0] || {};
        const newWorking = Math.max(parseInt(current.total_working_time || 0, 10), parseInt(workingTime || 0, 10));
        const newIdle = Math.max(parseInt(current.total_idle_time || 0, 10), parseInt(idleTime || 0, 10));
        const newBreak = Math.max(parseInt(current.total_break_time || 0, 10), parseInt(breakTime || 0, 10));
        const newCalling = Math.max(parseInt(current.total_calling_time || 0, 10), parseInt(callingTime || 0, 10));
        await db.query(
          `UPDATE telecaller_sessions 
           SET total_working_time = $1, total_idle_time = $2, total_break_time = $3, total_calling_time = $4, last_updated_at = CURRENT_TIMESTAMP
           WHERE telecaller_id = $5 AND date = $6`,
          [newWorking, newIdle, newBreak, newCalling, userId, today]
        );
      }
    } else {
      const current = sessionCheck.rows[0];
      const newWorking = Math.max(parseInt(current.total_working_time || 0, 10), parseInt(workingTime || 0, 10));
      const newIdle = Math.max(parseInt(current.total_idle_time || 0, 10), parseInt(idleTime || 0, 10));
      const newBreak = Math.max(parseInt(current.total_break_time || 0, 10), parseInt(breakTime || 0, 10));
      const newCalling = Math.max(parseInt(current.total_calling_time || 0, 10), parseInt(callingTime || 0, 10));
      await db.query(
        `UPDATE telecaller_sessions 
         SET total_working_time = $1, total_idle_time = $2, total_break_time = $3, total_calling_time = $4, last_updated_at = CURRENT_TIMESTAMP
         WHERE telecaller_id = $5 AND date = $6`,
        [newWorking, newIdle, newBreak, newCalling, userId, today]
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
    const { telecallerId, date, contactId } = req.query;
    const parsedId = telecallerId ? parseInt(telecallerId, 10) : null;
    const parsedContactId = contactId ? parseInt(contactId, 10) : null;

    let queryText = `
      SELECT 
        cl.*,
        c.name as contact_name,
        c.phone_number as contact_phone,
        u.name as telecaller_name,
        camp.name as campaign_name
      FROM call_logs cl
      LEFT JOIN contacts c ON cl.contact_id = c.id
      LEFT JOIN users u ON cl.telecaller_id = u.id
      LEFT JOIN campaigns camp ON c.campaign_id = camp.id
    `;
    const params = [];
    const conditions = [];

    if (parsedId) {
      params.push(parsedId);
      conditions.push(`cl.telecaller_id = $${params.length}`);
    }

    if (parsedContactId) {
      params.push(parsedContactId);
      conditions.push(`cl.contact_id = $${params.length}`);
    }

    if (date) {
      params.push(date);
      const isPg = db.dbType === 'postgres';
      const isMonth = date.length === 7;
      let dateCast;
      if (isMonth) {
        dateCast = isPg ? `TO_CHAR(cl.called_at - INTERVAL '6 hours 30 minutes', 'YYYY-MM') = $${params.length}` : `strftime('%Y-%m', cl.called_at, '-6 hours', '-30 minutes') = $${params.length}`;
      } else {
        dateCast = isPg ? `(cl.called_at - INTERVAL '6 hours 30 minutes')::date = $${params.length}` : `date(cl.called_at, '-6 hours', '-30 minutes') = $${params.length}`;
      }
      conditions.push(dateCast);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ` + conditions.join(' AND ');
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
    const { telecallerId, date } = req.query;
    const parsedId = telecallerId ? parseInt(telecallerId, 10) : null;

    let overview;
    let campaigns;
    let callTrend;

    const isPg = db.dbType === 'postgres';
    const dateGrouping = isPg ? "TO_CHAR(called_at - INTERVAL '6 hours 30 minutes', 'YYYY-MM-DD')" : "date(called_at, '-6 hours', '-30 minutes')";

    const isMonth = date && date.length === 7;

    if (parsedId) {
      const callFilter = date ? (isMonth 
        ? (isPg ? "AND TO_CHAR(called_at - INTERVAL '6 hours 30 minutes', 'YYYY-MM') = $2" : "AND strftime('%Y-%m', called_at, '-6 hours', '-30 minutes') = $2")
        : (isPg ? "AND (called_at - INTERVAL '6 hours 30 minutes')::date = $2" : "AND date(called_at, '-6 hours', '-30 minutes') = $2")
      ) : '';

      let overviewQuery = `
        SELECT
          (SELECT COUNT(*) FROM contacts WHERE assigned_to = $1) as total_contacts,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'connected' AND telecaller_id = $1 ${callFilter}) as connected_calls,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'non-connected' AND telecaller_id = $1 ${callFilter}) as non_connected_calls,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'received' AND telecaller_id = $1 ${callFilter}) as received_calls,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'missed' AND telecaller_id = $1 ${callFilter}) as missed_calls,
          (SELECT SUM(duration) FROM call_logs WHERE telecaller_id = $1 ${callFilter}) as total_talk_time
      `;
      const oParams = [parsedId];
      if (date) oParams.push(date);
      overview = await db.query(overviewQuery, oParams);

      campaigns = await db.query(`
        SELECT c.status, COUNT(DISTINCT c.id) as count 
        FROM campaigns c 
        JOIN contacts con ON con.campaign_id = c.id 
        WHERE con.assigned_to = $1 
        GROUP BY c.status
      `, [parsedId]);

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
      const callFilterGlobal = date ? (isMonth 
        ? (isPg ? "AND TO_CHAR(called_at - INTERVAL '6 hours 30 minutes', 'YYYY-MM') = $1" : "AND strftime('%Y-%m', called_at, '-6 hours', '-30 minutes') = $1")
        : (isPg ? "AND (called_at - INTERVAL '6 hours 30 minutes')::date = $1" : "AND date(called_at, '-6 hours', '-30 minutes') = $1")
      ) : '';
      const sumFilterGlobal = date ? (isMonth
        ? (isPg ? "WHERE TO_CHAR(called_at - INTERVAL '6 hours 30 minutes', 'YYYY-MM') = $1" : "WHERE strftime('%Y-%m', called_at, '-6 hours', '-30 minutes') = $1")
        : (isPg ? "WHERE (called_at - INTERVAL '6 hours 30 minutes')::date = $1" : "WHERE date(called_at, '-6 hours', '-30 minutes') = $1")
      ) : '';

      let overviewQuery = `
        SELECT
          (SELECT COUNT(*) FROM contacts) as total_contacts,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'connected' ${callFilterGlobal}) as connected_calls,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'non-connected' ${callFilterGlobal}) as non_connected_calls,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'received' ${callFilterGlobal}) as received_calls,
          (SELECT COUNT(*) FROM call_logs WHERE call_status = 'missed' ${callFilterGlobal}) as missed_calls,
          (SELECT SUM(duration) FROM call_logs ${sumFilterGlobal}) as total_talk_time
      `;
      const oParams = [];
      if (date) oParams.push(date);
      overview = await db.query(overviewQuery, oParams);

      campaigns = await db.query(`
        SELECT status, COUNT(*) as count FROM campaigns GROUP BY status
      `);

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
    const activeDate = date || getTrackingDate();
    const isMonthActive = activeDate.length === 7;

    let tsSubquery = '';
    let clSubquery = '';

    if (isMonthActive) {
      tsSubquery = `
        SELECT 
          telecaller_id,
          SUM(total_working_time) as working_time,
          SUM(total_calling_time) as calling_time,
          SUM(total_idle_time) as idle_time,
          SUM(total_break_time) as break_time
        FROM telecaller_sessions
        WHERE ${isPg ? "TO_CHAR(date, 'YYYY-MM')" : "substr(date, 1, 7)"} = $1
        GROUP BY telecaller_id
      `;
      clSubquery = `
        SELECT 
          telecaller_id,
          COUNT(CASE WHEN call_status = 'connected' THEN 1 END) as connected_count,
          COUNT(CASE WHEN call_status = 'non-connected' THEN 1 END) as non_connected_count,
          COUNT(CASE WHEN call_status = 'received' THEN 1 END) as received_count,
          COUNT(CASE WHEN call_status = 'missed' THEN 1 END) as missed_count
        FROM call_logs
        WHERE ${isPg ? "TO_CHAR(called_at - INTERVAL '6 hours 30 minutes', 'YYYY-MM')" : "strftime('%Y-%m', called_at, '-6 hours', '-30 minutes')"} = $1
        GROUP BY telecaller_id
      `;
    } else {
      tsSubquery = `
        SELECT 
          telecaller_id,
          SUM(total_working_time) as working_time,
          SUM(total_calling_time) as calling_time,
          SUM(total_idle_time) as idle_time,
          SUM(total_break_time) as break_time
        FROM telecaller_sessions
        WHERE date = $1
        GROUP BY telecaller_id
      `;
      clSubquery = `
        SELECT 
          telecaller_id,
          COUNT(CASE WHEN call_status = 'connected' THEN 1 END) as connected_count,
          COUNT(CASE WHEN call_status = 'non-connected' THEN 1 END) as non_connected_count,
          COUNT(CASE WHEN call_status = 'received' THEN 1 END) as received_count,
          COUNT(CASE WHEN call_status = 'missed' THEN 1 END) as missed_count
        FROM call_logs
        WHERE ${isPg ? "(called_at - INTERVAL '6 hours 30 minutes')::date" : "date(called_at, '-6 hours', '-30 minutes')"} = $1
        GROUP BY telecaller_id
      `;
    }

    const callers = await db.query(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.status,
        COALESCE(ts.working_time, 0) as working_time,
        COALESCE(ts.calling_time, 0) as calling_time,
        COALESCE(ts.idle_time, 0) as idle_time,
        COALESCE(ts.break_time, 0) as break_time,
        COALESCE(cl.connected_count, 0) as connected_count,
        COALESCE(cl.non_connected_count, 0) as non_connected_count,
        COALESCE(cl.received_count, 0) as received_count,
        COALESCE(cl.missed_count, 0) as missed_count
      FROM users u
      LEFT JOIN (${tsSubquery}) ts ON u.id = ts.telecaller_id
      LEFT JOIN (${clSubquery}) cl ON u.id = cl.telecaller_id
      WHERE u.role = 'telecaller'
    `, [activeDate]);

    const overviewRow = overview.rows[0] || {};
    const formattedOverview = {
      total_contacts: parseInt(overviewRow.total_contacts, 10) || 0,
      connected_calls: parseInt(overviewRow.connected_calls, 10) || 0,
      non_connected_calls: parseInt(overviewRow.non_connected_calls, 10) || 0,
      received_calls: parseInt(overviewRow.received_calls, 10) || 0,
      missed_calls: parseInt(overviewRow.missed_calls, 10) || 0,
      total_talk_time: parseInt(overviewRow.total_talk_time, 10) || 0,
    };

    const formattedCallers = (callers.rows || []).map(tc => ({
      ...tc,
      working_time: parseInt(tc.working_time, 10) || 0,
      calling_time: parseInt(tc.calling_time, 10) || 0,
      idle_time: parseInt(tc.idle_time, 10) || 0,
      break_time: parseInt(tc.break_time, 10) || 0,
      connected_count: parseInt(tc.connected_count, 10) || 0,
      non_connected_count: parseInt(tc.non_connected_count, 10) || 0,
      received_count: parseInt(tc.received_count, 10) || 0,
      missed_count: parseInt(tc.missed_count, 10) || 0,
    }));

    res.json({
      overview: formattedOverview,
      campaigns: campaigns.rows,
      callers: formattedCallers,
      callTrend: callTrend.rows,
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Server error fetching analytics.' });
  }
};

// Fetch today's telemetry and call outcomes count for the logged-in telecaller
exports.getTodayTelemetry = async (req, res) => {
  const userId = req.user.id;
  const today = getTrackingDate();

  try {
    const sessionCheck = await db.query(
      'SELECT * FROM telecaller_sessions WHERE telecaller_id = $1 AND date = $2',
      [userId, today]
    );

    let session = {
      total_working_time: 0,
      total_calling_time: 0,
      total_idle_time: 0,
      total_break_time: 0
    };
    
    if (sessionCheck.rows.length > 0) {
      session = sessionCheck.rows[0];
    }

    const isPg = db.dbType === 'postgres';
    const dateFilter = isPg ? "(called_at - INTERVAL '6 hours 30 minutes')::date = $1" : "date(called_at, '-6 hours', '-30 minutes') = $1";
    const callsCheck = await db.query(
      `SELECT 
         COUNT(CASE WHEN call_status = 'connected' THEN 1 END) as connected,
         COUNT(CASE WHEN call_status = 'non-connected' THEN 1 END) as non_connected,
         COUNT(CASE WHEN call_status = 'received' THEN 1 END) as received,
         COUNT(CASE WHEN call_status = 'missed' THEN 1 END) as missed
       FROM call_logs 
       WHERE telecaller_id = $2 AND ${dateFilter}`,
      [today, userId]
    );

    const callCounts = callsCheck.rows[0] || { connected: 0, non_connected: 0, received: 0, missed: 0 };

    res.json({
      success: true,
      telemetry: {
        workingTime: parseInt(session.total_working_time || 0, 10),
        talkTime: parseInt(session.total_calling_time || 0, 10),
        idleTime: parseInt(session.total_idle_time || 0, 10),
        breakTime: parseInt(session.total_break_time || 0, 10),
      },
      calls: {
        connected: parseInt(callCounts.connected || 0, 10),
        nonConnected: parseInt(callCounts.non_connected || 0, 10),
        received: parseInt(callCounts.received || 0, 10),
        missed: parseInt(callCounts.missed || 0, 10),
      }
    });
  } catch (error) {
    console.error('Get today telemetry error:', error);
    res.status(500).json({ error: 'Server error fetching telemetry.' });
  }
};


