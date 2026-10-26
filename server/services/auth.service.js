
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const RefreshToken = require('../models/refreshToken.model');

const ACCESS_TOKEN_EXPIRY =
  process.env.JWT_ACCESS_EXPIRES_IN || '15m';

const REFRESH_TOKEN_EXPIRY =
  process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const createRefreshToken = () =>
  crypto.randomBytes(48).toString('hex');

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const parseDurationMs = (value, fallback) => {
  const match = /^(\d+)(s|m|h|d)$/.exec(value || '');
  if (!match) return fallback;
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return Number(match[1]) * units[match[2]];
};

const createAccessToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

const getSafeUser = (user) => ({
  id: user._id.toString(),
  username: user.username,
  email: user.email,
  fullName: user.fullName,
  avatar: user.avatar,
  bio: user.bio,
  role: user.role,
});

const issueTokens = async (user) => {
  const refreshToken = createRefreshToken();

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + parseDurationMs(REFRESH_TOKEN_EXPIRY, 7 * 86400000)),
  });

  return {
    user: getSafeUser(user),
    accessToken: createAccessToken(user),
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };
};

const register = async ({
  username,
  email,
  password,
  fullName = '',
}) => {
  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    const error = new Error(
      existingUser.email === email
        ? 'Email is already registered'
        : 'Username is already taken'
    );
    error.statusCode = 409;
    throw error;
  }

  try {
    const user = await User.create({
      username,
      email,
      password,
      fullName,
    });

    return issueTokens(user);
  } catch (error) {
    if (error.code === 11000) {
      const duplicateError = new Error(
        'Email or username is already registered'
      );
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  if (!user.isActive) {
    const error = new Error('This account is disabled');
    error.statusCode = 403;
    throw error;
  }

  return issueTokens(user);
};

const refresh = async (rawRefreshToken) => {
  if (
    typeof rawRefreshToken !== 'string' ||
    rawRefreshToken.length === 0
  ) {
    const error = new Error('Refresh token is required');
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = hashToken(rawRefreshToken);
  const now = new Date();

  const record = await RefreshToken.findOne({ tokenHash })
    .select('+tokenHash user expiresAt revokedAt createdAt')
    .lean();

  if (!record) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  if (record.revokedAt || record.expiresAt <= now) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  // Atomically revoke the token so it cannot be reused.
  const consumedToken = await RefreshToken.findOneAndUpdate(
    {
      _id: record._id,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { revokedAt: now } },
    { new: true }
  );

  if (!consumedToken) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(record.user);

  if (!user || !user.isActive) {
    const error = new Error('Account is unavailable');
    error.statusCode = 401;
    throw error;
  }

  return issueTokens(user);
};

const logout = async (rawRefreshToken) => {
  if (!rawRefreshToken) return;

  await RefreshToken.updateOne(
    {
      tokenHash: hashToken(rawRefreshToken),
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } }
  );
};

module.exports = {
  register,
  login,
  refresh,
  logout,
};
