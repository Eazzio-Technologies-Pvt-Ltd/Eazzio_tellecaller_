const jwt = require('jsonwebtoken');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_eazzio_telecaller_system_2026';

module.exports = (roles = []) => {
  // If role is passed as a string, convert to array
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;

      // Check if user is in a read-only Demo company and attempting a write action
      if (req.user && req.user.companyRegNum && req.user.companyRegNum.startsWith('EAZ-DEMO-')) {
        if (req.method !== 'GET') {
          return res.status(403).json({ error: 'demo_readonly', message: 'Actions are disabled in read-only demo mode.' });
        }
      }

      // Single active session check for telecallers
      if (req.user.role === 'telecaller') {
        const userCheck = await db.query('SELECT current_token FROM users WHERE id = $1', [req.user.id]);
        if (userCheck.rows.length > 0) {
          const currentToken = userCheck.rows[0].current_token;
          if (currentToken && currentToken !== token) {
            return res.status(401).json({ error: 'multiple_logins', message: 'You have logged in on another device.' });
          }
        }
      }

      // Check user role if roles array is defined
      if (roles.length > 0 && !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access forbidden. Insufficient permissions.' });
      }

      // If user is associated with a company, check if subscription is expired
      if (req.user.companyRegNum) {
        const path = req.originalUrl || '';
        const isRenewalOrMe = path.includes('/renew-subscription-with-payment') || 
                              path.includes('/razorpay-order') || 
                              path.includes('/me') ||
                              path.includes('/login');

        if (!isRenewalOrMe) {
          db.queryMain('SELECT subscription_end FROM companies WHERE reg_num = $1', [req.user.companyRegNum])
            .then(compCheck => {
              if (compCheck.rows.length > 0 && compCheck.rows[0].subscription_end) {
                const now = new Date();
                let expiryStr = compCheck.rows[0].subscription_end.toString();
                if (!expiryStr.includes('Z') && !expiryStr.includes('T')) {
                  expiryStr = expiryStr.replace(' ', 'T') + 'Z';
                }
                const expiry = new Date(expiryStr);
                if (expiry < now) {
                  return res.status(403).json({ 
                    error: 'subscription_expired',
                    message: 'Your company\'s Eazzio subscription has expired. Please renew your subscription to access this resource.' 
                  });
                }
              }
              next();
            })
            .catch(err => {
              console.error('Subscription check middleware error:', err);
              next(); // Fallback to allow if database fails
            });
          return;
        }
      }

      next();
    } catch (error) {
      console.error('JWT verification error:', error);
      res.status(401).json({ error: 'Invalid or expired token.' });
    }
  };
};

