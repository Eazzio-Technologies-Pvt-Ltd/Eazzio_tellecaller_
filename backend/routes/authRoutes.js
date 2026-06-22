const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/status', authMiddleware(), authController.updateStatus);
router.get('/me', authMiddleware(), authController.getMe);
router.get('/telecallers', authMiddleware('admin'), authController.getTelecallers);
router.delete('/:id', authMiddleware('admin'), authController.deleteUser);

module.exports = router;
