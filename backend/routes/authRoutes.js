const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup profile photos uploads directory
const profileUploadsDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(profileUploadsDir)) {
  fs.mkdirSync(profileUploadsDir, { recursive: true });
}

const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileUploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, `profile-${Date.now()}-${file.originalname}`);
  }
});

const profileUpload = multer({ storage: profileStorage });

router.post('/register', authMiddleware('admin'), authController.register);
router.post('/register-bulk', authMiddleware('admin'), authController.registerBulk);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/status', authMiddleware(), authController.updateStatus);
router.get('/me', authMiddleware(), authController.getMe);
router.put('/profile', authMiddleware(), profileUpload.single('profile_photo'), authController.updateProfile);
router.get('/colleagues', authMiddleware(), authController.getColleagues);
router.get('/telecallers', authMiddleware('admin'), authController.getTelecallers);
router.put('/telecallers/:id', authMiddleware('admin'), authController.editTelecaller);
router.delete('/:id', authMiddleware('admin'), authController.deleteUser);
router.put('/change-password', authMiddleware(), authController.changePassword);

// Tenant/Company Management Routes
router.post('/register-company', authController.registerCompany);
router.post('/register-demo-company', authController.registerDemoCompany);
router.post('/razorpay-order', authController.createRazorpayOrder);
router.post('/razorpay-edit-order', authMiddleware('admin'), authController.createRazorpayEditOrder);
router.post('/register-company-with-payment', authController.registerCompanyWithPayment);
router.post('/renew-subscription-with-payment', authMiddleware('admin'), authController.renewSubscriptionWithPayment);
router.post('/razorpay-extra-telecaller-order', authMiddleware('admin'), authController.createRazorpayExtraTelecallerOrder);
router.post('/add-extra-telecaller-with-payment', authMiddleware('admin'), authController.addExtraTelecallerWithPayment);
router.get('/companies', authMiddleware('admin'), authController.getCompanies);
router.get('/superadmin-stats', authMiddleware('admin'), authController.getSuperadminStats);
router.delete('/companies/:id', authMiddleware('admin'), authController.deleteCompany);
router.get('/companies/:regNum/telecallers', authMiddleware('admin'), authController.getCompanyTelecallers);
router.get('/company-billing', authMiddleware('admin'), authController.getCompanyBillingDetails);
router.post('/toggle-call-recording', authMiddleware('admin'), authController.toggleCallRecording);
router.post('/razorpay-call-recording-order', authMiddleware('admin'), authController.createCallRecordingOrder);
router.post('/enable-call-recording-with-payment', authMiddleware('admin'), authController.enableCallRecordingWithPayment);



module.exports = router;
