const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const campaignController = require('../controllers/campaignController');
const authMiddleware = require('../middleware/auth');

// Setup voice storage
const voiceDir = path.join(__dirname, '../uploads/voice');
if (!fs.existsSync(voiceDir)) {
  fs.mkdirSync(voiceDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, voiceDir);
  },
  filename: (req, file, cb) => {
    cb(null, `voice-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Accept standard audio formats
    const allowedTypes = ['.mp3', '.wav', '.ogg', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed (mp3, wav, ogg, m4a).'));
    }
  }
});

router.post('/', authMiddleware('admin'), campaignController.createCampaign);
router.get('/', authMiddleware(), campaignController.listCampaigns);
router.put('/:campaignId/status', authMiddleware('admin'), campaignController.updateCampaignStatus);
router.post('/upload-voice', authMiddleware('admin'), upload.single('file'), campaignController.uploadVoiceFile);
router.delete('/:campaignId', authMiddleware('admin'), campaignController.deleteCampaign);

module.exports = router;
