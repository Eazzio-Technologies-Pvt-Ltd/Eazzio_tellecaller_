const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaignController');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware('admin'), campaignController.createCampaign);
router.get('/', authMiddleware(), campaignController.listCampaigns);
router.put('/:campaignId/status', authMiddleware('admin'), campaignController.updateCampaignStatus);
router.delete('/:campaignId', authMiddleware('admin'), campaignController.deleteCampaign);

module.exports = router;
