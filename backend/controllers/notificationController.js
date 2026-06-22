const db = require('../config/database');

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
