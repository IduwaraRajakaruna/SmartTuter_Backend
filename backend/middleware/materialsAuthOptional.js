// Optional auth middleware for materials endpoints.
// Your current frontend stores/mock auth and may not send a real JWT.
// If Authorization header is present and valid, this sets req.user.
// Otherwise, it continues without req.user.

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch {
    // ignore invalid token
  }
  next();
};

