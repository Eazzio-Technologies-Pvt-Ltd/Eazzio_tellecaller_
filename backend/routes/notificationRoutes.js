const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');

// All routes here are restricted to admin role
router.get('/', authMiddleware('admin'), notificationController.listNotifications);
router.delete('/', authMiddleware('admin'), notificationController.clearAllNotifications);
router.delete('/:id', authMiddleware('admin'), notificationController.deleteNotification);

module.exports = router;
