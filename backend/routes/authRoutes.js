const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

router.post('/register', authMiddleware('admin'), authController.register);
router.post('/register-bulk', authMiddleware('admin'), authController.registerBulk);
router.post('/login', authController.login);
router.post('/status', authMiddleware(), authController.updateStatus);
router.get('/me', authMiddleware(), authController.getMe);
router.get('/telecallers', authMiddleware('admin'), authController.getTelecallers);
router.put('/telecallers/:id', authMiddleware('admin'), authController.editTelecaller);
router.delete('/:id', authMiddleware('admin'), authController.deleteUser);

// Tenant/Company Management Routes
router.post('/register-company', authController.registerCompany);
router.post('/razorpay-order', authController.createRazorpayOrder);
router.post('/razorpay-edit-order', authMiddleware('admin'), authController.createRazorpayEditOrder);
router.post('/register-company-with-payment', authController.registerCompanyWithPayment);
router.get('/companies', authMiddleware('admin'), authController.getCompanies);
router.get('/superadmin-stats', authMiddleware('admin'), authController.getSuperadminStats);
router.delete('/companies/:id', authMiddleware('admin'), authController.deleteCompany);
router.get('/companies/:regNum/telecallers', authMiddleware('admin'), authController.getCompanyTelecallers);
router.get('/company-billing', authMiddleware('admin'), authController.getCompanyBillingDetails);

module.exports = router;
