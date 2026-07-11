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
  const targetYear = year;
  const targetMonth = String(month).padStart(2, '0');
  const targetDay = String(day).padStart(2, '0');
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

    const insertRes = await db.query(
      `INSERT INTO call_logs (contact_id, telecaller_id, call_status, duration, feedback, recording_url, called_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [contactId, userId, callStatus, parseInt(duration || 0), feedback || '', recordingUrl, insertTime]
    );

    // If there is a recording URL, also insert into call_recordings table
    if (recordingUrl && insertRes.rows.length > 0) {
      const callLogId = insertRes.rows[0].id;
      try {
        await db.query(
          'INSERT INTO call_recordings (call_log_id, recording_url) VALUES ($1, $2)',
          [callLogId, recordingUrl]
        );
      } catch (recErr) {
        console.error('Error inserting into call_recordings:', recErr.message);
      }
    }

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

    // Update try_count, last_try_date, and response feedback
    try {
      const contactCheck = await db.query('SELECT try_count, last_try_date FROM contacts WHERE id = $1', [contactId]);
      if (contactCheck.rows.length > 0) {
        const contactRow = contactCheck.rows[0];
        const todayStr = getTrackingDate(); // YYYY-MM-DD
        let currentTry = contactRow.try_count || 0;
        let lastTryDate = contactRow.last_try_date ? getTrackingDate(contactRow.last_try_date) : '';
        
        if (lastTryDate !== todayStr) {
          // New day - reset try count to 1 and clear older response fields
          await db.query(
            "UPDATE contacts SET try_count = 1, last_try_date = CURRENT_DATE, response_1 = $1, response_2 = '', response_3 = '' WHERE id = $2",
            [feedback || '', contactId]
          );
        } else {
          currentTry = currentTry + 1;
          let respCol = '';
          if (currentTry === 2) respCol = 'response_2';
          else if (currentTry === 3) respCol = 'response_3';

          let tryUpdateSql = 'UPDATE contacts SET try_count = $1, last_try_date = CURRENT_DATE';
          const tryParams = [currentTry];

          if (respCol) {
            tryUpdateSql += `, ${respCol} = $2`;
            tryParams.push(feedback || '');
            tryUpdateSql += ` WHERE id = $3`;
            tryParams.push(contactId);
          } else {
            tryUpdateSql += ` WHERE id = $2`;
            tryParams.push(contactId);
          }
          await db.query(tryUpdateSql, tryParams);
        }
      }
    } catch (tryErr) {
      console.error('Error updating contact try count and responses:', tryErr.message);
    }

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

// Record telemetry delta since last active timestamp based on server wall-clock time
exports.recordTelemetryDelta = async (userId) => {
  const today = getTrackingDate();
  try {
    const isPg = db.dbType === 'postgres';
    const userSql = isPg
      ? `SELECT status, name, last_active_at, 
                COALESCE(EXTRACT(EPOCH FROM (clock_timestamp() - last_active_at))::integer, 0) as db_delta 
         FROM users WHERE id = $1`
      : `SELECT status, name, last_active_at FROM users WHERE id = $1`;

    const userCheck = await db.query(userSql, [userId]);
    if (userCheck.rows.length === 0) return;
    const user = userCheck.rows[0];
    const originalStatus = user.status;

    if (originalStatus === 'offline') {
      // Offline users do not accumulate telemetry metrics
      await db.query('UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = $1', [userId]);
      return;
    }

    const lastActive = user.last_active_at ? new Date(user.last_active_at) : null;
    const now = new Date();

    let delta = 0;
    if (lastActive) {
      delta = isPg ? (user.db_delta || 0) : Math.floor((now.getTime() - lastActive.getTime()) / 1000);
    }
    if (delta <= 0) return;

    let workDelta = 0;
    let idleDelta = 0;
    let breakDelta = 0;
    let callingDelta = 0;

    if (delta <= 35) {
      // Normal heartbeat/transition interval
      if (originalStatus === 'online') {
        workDelta = delta;
        idleDelta = delta;
      } else if (originalStatus === 'calling') {
        workDelta = delta;
        callingDelta = delta;
      } else if (originalStatus === 'break') {
        breakDelta = delta;
      }
    } else {
      // Heartbeat missed beyond 2x threshold (35 seconds)!
      // The gap is counted as break time, not active working or calling time.
      breakDelta = delta;
      console.log(`[StatusMonitor] Telecaller ${user.name} missed heartbeat. Gap of ${delta}s counted as Break.`);
    }

    // Get or create session row for today
    const sessionCheck = await db.query(
      'SELECT * FROM telecaller_sessions WHERE telecaller_id = $1 AND date = $2',
      [userId, today]
    );

    let session = {
      total_working_time: 0,
      total_idle_time: 0,
      total_break_time: 0,
      total_calling_time: 0
    };

    if (sessionCheck.rows.length === 0) {
      await db.query(
        `INSERT INTO telecaller_sessions (telecaller_id, date, total_working_time, total_idle_time, total_break_time, total_calling_time) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, today, workDelta, idleDelta, breakDelta, callingDelta]
      );
      session.total_working_time = workDelta;
      session.total_idle_time = idleDelta;
      session.total_break_time = breakDelta;
      session.total_calling_time = callingDelta;
    } else {
      const current = sessionCheck.rows[0];
      const newWorking = (parseInt(current.total_working_time || 0, 10)) + workDelta;
      const newIdle = (parseInt(current.total_idle_time || 0, 10)) + idleDelta;
      const newBreak = (parseInt(current.total_break_time || 0, 10)) + breakDelta;
      const newCalling = (parseInt(current.total_calling_time || 0, 10)) + callingDelta;

      await db.query(
        `UPDATE telecaller_sessions 
         SET total_working_time = $1, total_idle_time = $2, total_break_time = $3, total_calling_time = $4, last_updated_at = CURRENT_TIMESTAMP
         WHERE telecaller_id = $5 AND date = $6`,
        [newWorking, newIdle, newBreak, newCalling, userId, today]
      );
      session.total_working_time = newWorking;
      session.total_idle_time = newIdle;
      session.total_break_time = newBreak;
      session.total_calling_time = newCalling;
    }

    console.log(`[TelemetrySync] Telecaller: ${user.name} | Status: ${originalStatus} | Last Active: ${lastActive ? lastActive.toISOString() : 'None'} | Now: ${now.toISOString()} | Delta: ${delta}s | Increments -> Work: +${workDelta}s, Idle: +${idleDelta}s, Break: +${breakDelta}s, Talk: +${callingDelta}s | Totals -> Work: ${session.total_working_time}s, Talk: ${session.total_calling_time}s`);
  } catch (error) {
    console.error('Error recording telemetry delta:', error);
  }
};

// Sync Telemetry session timers (working time, idle time, break time)
exports.syncTelemetry = async (req, res) => {
  const userId = req.user.id;
  try {
    // Extract client-side cumulative timers from request body
    const clientWorkingTime = parseInt(req.body.workingTime || 0, 10);
    const clientIdleTime = parseInt(req.body.idleTime || 0, 10);
    const clientBreakTime = parseInt(req.body.breakTime || 0, 10);
    const clientCallingTime = parseInt(req.body.callingTime || 0, 10);
    const hasClientData = clientWorkingTime > 0 || clientIdleTime > 0 || clientBreakTime > 0 || clientCallingTime > 0;

    // Record server-side delta since last active timestamp (wall-clock source of truth)
    await exports.recordTelemetryDelta(userId);

    const today = getTrackingDate();
    let finalWorking = 0, finalIdle = 0, finalBreak = 0, finalCalling = 0;

    // If client sent cumulative values, reconcile by taking max(server, client) for each metric
    if (hasClientData) {
      const sessionCheck = await db.query(
        'SELECT * FROM telecaller_sessions WHERE telecaller_id = $1 AND date = $2',
        [userId, today]
      );
      if (sessionCheck.rows.length > 0) {
        const current = sessionCheck.rows[0];
        finalWorking  = Math.max(parseInt(current.total_working_time  || 0, 10), clientWorkingTime);
        finalIdle     = Math.max(parseInt(current.total_idle_time     || 0, 10), clientIdleTime);
        finalBreak    = Math.max(parseInt(current.total_break_time    || 0, 10), clientBreakTime);
        finalCalling  = Math.max(parseInt(current.total_calling_time  || 0, 10), clientCallingTime);
        await db.query(
          `UPDATE telecaller_sessions
           SET total_working_time = $1, total_idle_time = $2, total_break_time = $3, total_calling_time = $4, last_updated_at = CURRENT_TIMESTAMP
           WHERE telecaller_id = $5 AND date = $6`,
          [finalWorking, finalIdle, finalBreak, finalCalling, userId, today]
        );
        console.log(`[TelemetryReconcile] User ${userId} | Client: W${clientWorkingTime}s I${clientIdleTime}s B${clientBreakTime}s C${clientCallingTime}s | Server (final): W${finalWorking}s I${finalIdle}s B${finalBreak}s C${finalCalling}s`);
      } else {
        // No session yet — create one with client values
        try {
          await db.query(
            `INSERT INTO telecaller_sessions (telecaller_id, date, total_working_time, total_idle_time, total_break_time, total_calling_time)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, today, clientWorkingTime, clientIdleTime, clientBreakTime, clientCallingTime]
          );
          finalWorking = clientWorkingTime; finalIdle = clientIdleTime;
          finalBreak = clientBreakTime; finalCalling = clientCallingTime;
        } catch (insErr) {
          // Row inserted by recordTelemetryDelta above, re-read it
          const reread = await db.query(
            'SELECT * FROM telecaller_sessions WHERE telecaller_id = $1 AND date = $2',
            [userId, today]
          );
          if (reread.rows.length > 0) {
            finalWorking  = parseInt(reread.rows[0].total_working_time  || 0, 10);
            finalIdle     = parseInt(reread.rows[0].total_idle_time     || 0, 10);
            finalBreak    = parseInt(reread.rows[0].total_break_time    || 0, 10);
            finalCalling  = parseInt(reread.rows[0].total_calling_time  || 0, 10);
          }
        }
      }
    } else {
      // No client data — just read server values to return
      const sessionCheck = await db.query(
        'SELECT * FROM telecaller_sessions WHERE telecaller_id = $1 AND date = $2',
        [userId, today]
      );
      if (sessionCheck.rows.length > 0) {
        finalWorking  = parseInt(sessionCheck.rows[0].total_working_time  || 0, 10);
        finalIdle     = parseInt(sessionCheck.rows[0].total_idle_time     || 0, 10);
        finalBreak    = parseInt(sessionCheck.rows[0].total_break_time    || 0, 10);
        finalCalling  = parseInt(sessionCheck.rows[0].total_calling_time  || 0, 10);
      }
    }

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

    // ── FIX 1: Return server-side corrected values so mobile can reconcile local counters ──
    res.json({
      success: true,
      serverValues: {
        workingTime: finalWorking,
        talkTime:    finalCalling,
        idleTime:    finalIdle,
        breakTime:   finalBreak,
      }
    });
  } catch (error) {
    console.error('Sync telemetry error:', error);
    res.status(500).json({ error: 'Server error syncing telemetry.' });
  }
};

// Fetch call logs for Admin/Telecaller (filters: user, search, dates)
exports.getCallLogs = async (req, res) => {
  try {
    const { telecallerId, date, contactId } = req.query;
    let parsedId = telecallerId ? parseInt(telecallerId, 10) : null;
    const parsedContactId = contactId ? parseInt(contactId, 10) : null;

    // Enforce scoping if requester is a telecaller
    if (req.user && req.user.role === 'telecaller') {
      parsedId = req.user.id;
    }

    let queryText = `
      SELECT 
        cl.*,
        c.name as contact_name,
        c.phone_number as contact_phone,
        c.try_count,
        c.response_1,
        c.response_2,
        c.response_3,
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
        dateCast = isPg ? `TO_CHAR(cl.called_at + INTERVAL '5 hours 30 minutes', 'YYYY-MM') = $${params.length}` : `strftime('%Y-%m', cl.called_at, '+5 hours', '+30 minutes') = $${params.length}`;
      } else {
        dateCast = isPg ? `(cl.called_at + INTERVAL '5 hours 30 minutes')::date = $${params.length}` : `date(cl.called_at, '+5 hours', '+30 minutes') = $${params.length}`;
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
    const dateGrouping = isPg ? "TO_CHAR(called_at + INTERVAL '5 hours 30 minutes', 'YYYY-MM-DD')" : "date(called_at, '+5 hours', '+30 minutes')";

    const isMonth = date && date.length === 7;

    if (parsedId) {
      const callFilter = date ? (isMonth 
        ? (isPg ? "AND TO_CHAR(timestamp + INTERVAL '5 hours 30 minutes', 'YYYY-MM') = $2" : "AND strftime('%Y-%m', timestamp, '+5 hours', '+30 minutes') = $2")
        : (isPg ? "AND (timestamp + INTERVAL '5 hours 30 minutes')::date = $2" : "AND date(timestamp, '+5 hours', '+30 minutes') = $2")
      ) : '';

      let overviewQuery = `
        SELECT
          (SELECT COUNT(*) FROM contacts WHERE assigned_to = $1) as total_contacts,
          (SELECT COUNT(*) FROM call_activities WHERE call_type = 'connected' AND telecaller_id = $1 ${callFilter}) as connected_calls,
          (SELECT COUNT(*) FROM call_activities WHERE call_type = 'non_connected' AND telecaller_id = $1 ${callFilter}) as non_connected_calls,
          (SELECT COUNT(*) FROM call_activities WHERE call_type = 'received' AND telecaller_id = $1 ${callFilter}) as received_calls,
          (SELECT COUNT(*) FROM call_activities WHERE call_type = 'missed' AND telecaller_id = $1 ${callFilter}) as missed_calls,
          (SELECT SUM(duration_seconds) FROM call_activities WHERE telecaller_id = $1 ${callFilter}) as total_talk_time
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
          ${dateGrouping.replace(/called_at/g, 'timestamp')} as call_date,
          COUNT(CASE WHEN call_type = 'connected' THEN 1 END) as connected,
          COUNT(CASE WHEN call_type = 'missed' THEN 1 END) as missed
        FROM call_activities
        WHERE telecaller_id = $1
        GROUP BY call_date
        ORDER BY call_date ASC
        LIMIT 7
      `, [parsedId]);
    } else {
      const callFilterGlobal = date ? (isMonth 
        ? (isPg ? "AND TO_CHAR(timestamp + INTERVAL '5 hours 30 minutes', 'YYYY-MM') = $1" : "AND strftime('%Y-%m', timestamp, '+5 hours', '+30 minutes') = $1")
        : (isPg ? "AND (timestamp + INTERVAL '5 hours 30 minutes')::date = $1" : "AND date(timestamp, '+5 hours', '+30 minutes') = $1")
      ) : '';
      const sumFilterGlobal = date ? (isMonth
        ? (isPg ? "WHERE TO_CHAR(timestamp + INTERVAL '5 hours 30 minutes', 'YYYY-MM') = $1" : "WHERE strftime('%Y-%m', timestamp, '+5 hours', '+30 minutes') = $1")
        : (isPg ? "WHERE (timestamp + INTERVAL '5 hours 30 minutes')::date = $1" : "WHERE date(timestamp, '+5 hours', '+30 minutes') = $1")
      ) : '';

      let overviewQuery = `
        SELECT
          (SELECT COUNT(*) FROM contacts) as total_contacts,
          (SELECT COUNT(*) FROM call_activities WHERE call_type = 'connected' ${callFilterGlobal}) as connected_calls,
          (SELECT COUNT(*) FROM call_activities WHERE call_type = 'non_connected' ${callFilterGlobal}) as non_connected_calls,
          (SELECT COUNT(*) FROM call_activities WHERE call_type = 'received' ${callFilterGlobal}) as received_calls,
          (SELECT COUNT(*) FROM call_activities WHERE call_type = 'missed' ${callFilterGlobal}) as missed_calls,
          (SELECT SUM(duration_seconds) FROM call_activities ${sumFilterGlobal}) as total_talk_time
      `;
      const oParams = [];
      if (date) oParams.push(date);
      overview = await db.query(overviewQuery, oParams);

      campaigns = await db.query(`
        SELECT status, COUNT(*) as count FROM campaigns GROUP BY status
      `);

      callTrend = await db.query(`
        SELECT 
          ${dateGrouping.replace(/called_at/g, 'timestamp')} as call_date,
          COUNT(CASE WHEN call_type = 'connected' THEN 1 END) as connected,
          COUNT(CASE WHEN call_type = 'missed' THEN 1 END) as missed
        FROM call_activities
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
          COUNT(CASE WHEN call_type = 'connected' THEN 1 END) as connected_count,
          COUNT(CASE WHEN call_type = 'non_connected' THEN 1 END) as non_connected_count,
          COUNT(CASE WHEN call_type = 'received' THEN 1 END) as received_count,
          COUNT(CASE WHEN call_type = 'missed' THEN 1 END) as missed_count,
          COALESCE(SUM(duration_seconds), 0) as talk_time
        FROM call_activities
        WHERE ${isPg ? "TO_CHAR(timestamp + INTERVAL '5 hours 30 minutes', 'YYYY-MM')" : "strftime('%Y-%m', timestamp, '+5 hours', '+30 minutes')"} = $1
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
          COUNT(CASE WHEN call_type = 'connected' THEN 1 END) as connected_count,
          COUNT(CASE WHEN call_type = 'non_connected' THEN 1 END) as non_connected_count,
          COUNT(CASE WHEN call_type = 'received' THEN 1 END) as received_count,
          COUNT(CASE WHEN call_type = 'missed' THEN 1 END) as missed_count,
          COALESCE(SUM(duration_seconds), 0) as talk_time
        FROM call_activities
        WHERE ${isPg ? "(timestamp + INTERVAL '5 hours 30 minutes')::date" : "date(timestamp, '+5 hours', '+30 minutes')"} = $1
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
        COALESCE(cl.talk_time, 0) as calling_time,
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
    // ── FIX 2: Flush any pending wall-clock delta before reading so values are always current ──
    await exports.recordTelemetryDelta(userId);

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

    // Fetch company shift limits
    let workTimeLimitHours = 8;
    let talkTimeLimitHours = 4;
    if (req.user && req.user.companyRegNum) {
      try {
        const compSettings = await db.queryMain(
          'SELECT work_time_limit_hours, talk_time_limit_hours FROM companies WHERE reg_num = $1',
          [req.user.companyRegNum]
        );
        if (compSettings.rows.length > 0) {
          workTimeLimitHours = parseInt(compSettings.rows[0].work_time_limit_hours || 8, 10);
          talkTimeLimitHours = parseInt(compSettings.rows[0].talk_time_limit_hours || 4, 10);
        }
      } catch (limErr) {
        console.error('Error fetching company shift limits:', limErr.message);
      }
    }

    const isPg = db.dbType === 'postgres';
    const dateFilter = isPg ? "(timestamp + INTERVAL '5 hours 30 minutes')::date = $1" : "date(timestamp, '+5 hours', '+30 minutes') = $1";
    const callsCheck = await db.query(
      `SELECT 
         COUNT(CASE WHEN call_type = 'connected' THEN 1 END) as connected,
         COUNT(CASE WHEN call_type = 'non_connected' THEN 1 END) as non_connected,
         COUNT(CASE WHEN call_type = 'received' THEN 1 END) as received,
         COUNT(CASE WHEN call_type = 'missed' THEN 1 END) as missed,
         COALESCE(SUM(CASE WHEN call_type = 'connected' THEN duration_seconds END), 0) as connected_duration,
         COALESCE(SUM(CASE WHEN call_type = 'non_connected' THEN duration_seconds END), 0) as non_connected_duration,
         COALESCE(SUM(CASE WHEN call_type = 'received' THEN duration_seconds END), 0) as received_duration,
         COALESCE(SUM(CASE WHEN call_type = 'missed' THEN duration_seconds END), 0) as missed_duration
       FROM call_activities 
       WHERE telecaller_id = $2 AND ${dateFilter}`,
      [today, userId]
    );

    const talkTimeCheck = await db.query(
      `SELECT COALESCE(SUM(duration_seconds), 0) as talk_time 
       FROM call_activities 
       WHERE telecaller_id = $2 AND ${dateFilter}`,
      [today, userId]
    );

    const callCounts = callsCheck.rows[0] || { 
      connected: 0, non_connected: 0, received: 0, missed: 0,
      connected_duration: 0, non_connected_duration: 0, received_duration: 0, missed_duration: 0
    };
    const talkTime = parseInt(talkTimeCheck.rows[0].talk_time, 10);

    res.json({
      success: true,
      telemetry: {
        workingTime: parseInt(session.total_working_time || 0, 10),
        talkTime: talkTime,
        idleTime: parseInt(session.total_idle_time || 0, 10),
        breakTime: parseInt(session.total_break_time || 0, 10),
        workTimeLimitHours: workTimeLimitHours,
        talkTimeLimitHours: talkTimeLimitHours,
      },
      calls: {
        connected: parseInt(callCounts.connected || 0, 10),
        nonConnected: parseInt(callCounts.non_connected || 0, 10),
        received: parseInt(callCounts.received || 0, 10),
        missed: parseInt(callCounts.missed || 0, 10),
        connectedDuration: parseInt(callCounts.connected_duration || 0, 10),
        nonConnectedDuration: parseInt(callCounts.non_connected_duration || 0, 10),
        receivedDuration: parseInt(callCounts.received_duration || 0, 10),
        missedDuration: parseInt(callCounts.missed_duration || 0, 10),
      }
    });
  } catch (error) {
    console.error('Get today telemetry error:', error);
    res.status(500).json({ error: 'Server error fetching telemetry.' });
  }
};

exports.syncCallActivities = async (req, res) => {
  const userId = req.user.id;
  const { activities } = req.body;

  if (!activities || !Array.isArray(activities)) {
    return res.status(400).json({ error: 'Activities array is required.' });
  }

  try {
    const contactsRes = await db.query(
      'SELECT id, phone_number, created_at FROM contacts WHERE assigned_to = $1 ORDER BY created_at DESC',
      [userId]
    );
    const assignedContacts = contactsRes.rows;

    const normalize = (num) => {
      if (!num) return '';
      let clean = num.toString().replace(/\D/g, '');
      if (clean.length === 12 && clean.startsWith('91')) {
        clean = clean.substring(2);
      }
      if (clean.length > 10) {
        clean = clean.substring(clean.length - 10);
      }
      return clean;
    };

    let syncedCount = 0;

    for (const activity of activities) {
      const { phoneNumber, callType, durationSeconds, timestamp } = activity;
      if (!phoneNumber || !callType || !timestamp) continue;

      const normPhone = normalize(phoneNumber);
      if (!normPhone) continue;

      const match = assignedContacts.find(c => normalize(c.phone_number) === normPhone);
      if (!match) continue; // Skip personal calls

      const leadId = match.id;
      const activityTime = new Date(timestamp);

      // Deduplication check: timestamp (within a 5-second window), duration, phoneNumber
      const targetTimeMs = activityTime.getTime();
      const existingActivities = await db.query(
        'SELECT id, timestamp FROM call_activities WHERE telecaller_id = $1 AND phone_number = $2 AND duration_seconds = $3',
        [userId, phoneNumber, parseInt(durationSeconds || 0)]
      );

      let isDuplicate = false;
      for (const row of existingActivities.rows) {
        const rowTimeMs = new Date(row.timestamp).getTime();
        if (Math.abs(rowTimeMs - targetTimeMs) < 5000) {
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) continue;

      await db.query(
        `INSERT INTO call_activities (lead_id, telecaller_id, call_type, duration_seconds, phone_number, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [leadId, userId, callType, parseInt(durationSeconds || 0), phoneNumber, activityTime]
      );
      syncedCount++;
    }

    res.status(200).json({ success: true, message: `Successfully synced ${syncedCount} call activities.` });
  } catch (error) {
    console.error('Sync call activities error:', error);
    res.status(500).json({ error: 'Server error syncing call activities.' });
  }
};


