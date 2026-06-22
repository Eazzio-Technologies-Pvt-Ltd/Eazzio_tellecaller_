const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_eazzio_telecaller_system_2026';

module.exports = (roles = []) => {
  // If role is passed as a string, convert to array
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;

      // Check user role if roles array is defined
      if (roles.length > 0 && !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Access forbidden. Insufficient permissions.' });
      }

      next();
    } catch (error) {
      console.error('JWT verification error:', error);
      res.status(401).json({ error: 'Invalid or expired token.' });
    }
  };
};
