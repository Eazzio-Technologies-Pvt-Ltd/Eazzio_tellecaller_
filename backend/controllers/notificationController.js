const db = require('../config/database');
const EventEmitter = require('events');
const notificationEvents = new EventEmitter();

// List all notifications (Admin only)
exports.listNotifications = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM admin_notifications ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ error: 'Server error listing notifications.' });
  }
};

// Delete a single notification (Admin only)
exports.deleteNotification = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM admin_notifications WHERE id = $1', [id]);
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Server error deleting notification.' });
  }
};

// Clear all notifications (Admin only)
exports.clearAllNotifications = async (req, res) => {
  try {
    await db.query('DELETE FROM admin_notifications');
    res.json({ success: true, message: 'All notifications cleared.' });
  } catch (error) {
    console.error('Clear all notifications error:', error);
    res.status(500).json({ error: 'Server error clearing notifications.' });
  }
};

// Real-time SSE Stream for Admin Notifications
exports.streamNotifications = (req, res) => {
  const companyRegNum = req.user.companyRegNum;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send a heartbeat ping every 15 seconds to keep the connection alive
  const pingInterval = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  const onNotification = (data) => {
    // Only stream notifications belonging to this tenant/company
    if (data.companyRegNum === companyRegNum) {
      res.write(`data: ${JSON.stringify(data.notification)}\n\n`);
    }
  };

  notificationEvents.on('new-notification', onNotification);

  req.on('close', () => {
    clearInterval(pingInterval);
    notificationEvents.off('new-notification', onNotification);
    res.end();
  });
};

// Helper function to insert notification and trigger SSE event
exports.createNotification = async (message, companyRegNum = null) => {
  try {
    await db.dbStorage.run({ companyRegNum }, async () => {
      await db.query(
        'INSERT INTO admin_notifications (message) VALUES ($1)',
        [message]
      );
      
      const result = await db.query(
        'SELECT * FROM admin_notifications ORDER BY id DESC LIMIT 1'
      );
      
      if (result.rows && result.rows.length > 0) {
        const newNotification = result.rows[0];
        notificationEvents.emit('new-notification', {
          companyRegNum,
          notification: newNotification
        });
      }
    });
  } catch (err) {
    console.error('[NotificationService] Error creating notification:', err);
  }
};
