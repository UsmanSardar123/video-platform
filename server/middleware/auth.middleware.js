
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const authenticate = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET
    );

    const user = await User.findById(decoded.sub).select(
      '_id username email fullName avatar bio role isActive'
    );

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is unavailable',
      });
    }

    req.user = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      avatar: user.avatar,
      bio: user.bio,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' ||
        error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired access token',
      });
    }

    next(error);
  }
};

const optionalAuthenticate = async (req, res, next) => {
  if (!req.headers.authorization) return next();
  return authenticate(req, res, next);
};

const requireAdmin = (req, res, next) => {
  return authorizeRoles('admin')(req, res, next);
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
  }
  return next();
};

const requireCreator = authorizeRoles('creator');

module.exports = { authenticate, optionalAuthenticate, authorizeRoles, requireAdmin, requireCreator };
