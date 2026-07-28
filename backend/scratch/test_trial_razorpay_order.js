const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runTest() {
  console.log('--- Testing Razorpay Order Creation (Trial vs Paid) ---');

  // Load authController
  const authController = require('../controllers/authController');

  // Mock res object
  const createMockRes = (label) => ({
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(data) {
      console.log(`\n[${label} Response (${this.statusCode || 200})]:`, JSON.stringify(data, null, 2));
    }
  });

  // Test 1: Trial / Demo Order Creation
  const trialReq = {
    body: {
      noOfTelecallers: 5,
      planType: 'demo',
      isTrial: true
    }
  };
  console.log('\n================ TEST 1: TRIAL ORDER ================');
  try {
    await authController.createRazorpayOrder(trialReq, createMockRes('TRIAL_TEST'));
  } catch (err) {
    console.error('Trial Test Error:', err);
  }

  // Test 2: Standard Paid Basic Plan Order Creation
  const paidReq = {
    body: {
      noOfTelecallers: 5,
      planType: 'basic',
      isTrial: false
    }
  };
  console.log('\n================ TEST 2: PAID BASIC ORDER ================');
  try {
    await authController.createRazorpayOrder(paidReq, createMockRes('PAID_TEST'));
  } catch (err) {
    console.error('Paid Test Error:', err);
  }
}

runTest();
