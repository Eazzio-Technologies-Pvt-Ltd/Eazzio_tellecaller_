const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const callLogController = require('../controllers/callLogController');
const authMiddleware = require('../middleware/auth');

// Setup call recordings storage directory
const recordingsDir = path.join(__dirname, '../uploads/recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, recordingsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `rec-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// Telecaller logs and telemetry sync
router.post('/', authMiddleware('telecaller'), upload.single('recording'), callLogController.createCallLog);
router.post('/telemetry/sync', authMiddleware('telecaller'), callLogController.syncTelemetry);

// Admin reporting and logs list
router.get('/', authMiddleware('admin'), callLogController.getCallLogs);
router.get('/analytics', authMiddleware('admin'), callLogController.getAnalytics);

module.exports = router;
