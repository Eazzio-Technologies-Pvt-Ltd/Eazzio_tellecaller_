const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const contactController = require('../controllers/contactController');
const authMiddleware = require('../middleware/auth');

// Setup multer storage for temporary CSV files
const uploadDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `csv-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed.'));
    }
  }
});

// Admin-only contact upload and manual allotment
router.post('/import', authMiddleware('admin'), upload.single('file'), contactController.importContacts);
router.post('/allot', authMiddleware('admin'), contactController.allotContactsManually);
router.post('/assign-campaign', authMiddleware('admin'), contactController.assignCampaignContacts);
router.get('/', authMiddleware('admin'), contactController.getContacts);

// Telecaller endpoints
router.get('/allotted', authMiddleware('telecaller'), contactController.getAllottedContacts);
router.put('/:contactId/status', authMiddleware(), contactController.updateContactStatus);
router.put('/:contactId/assign', authMiddleware('admin'), contactController.assignContact);

module.exports = router;
