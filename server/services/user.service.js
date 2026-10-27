const mongoose = require('mongoose');
const User = require('../models/user.model');
const Video = require('../models/video.model');
const RefreshToken = require('../models/refreshToken.model');
const { deleteVideoAssets } = require('./cloudinary.service');
const ApiError = require('../utils/apiError.util');

const deleteAccount = async (userId, password) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!(await user.comparePassword(password))) throw new ApiError(401, 'Current password is incorrect');

  const videos = await Video.find({ creator: userId }).select('cloudinaryPublicId').lean();
  const publicIds = videos.map((video) => video.cloudinaryPublicId).filter(Boolean);
  await deleteVideoAssets(publicIds);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Video.deleteMany({ creator: userId }, { session });
      await RefreshToken.deleteMany({ user: userId }, { session });
      await User.deleteOne({ _id: userId }, { session });
    });
  } finally { await session.endSession(); }
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  if (currentPassword === newPassword) {
    throw new ApiError(400, 'New password must be different from your current password');
  }

  user.password = newPassword;
  await user.save();

  // Invalidate all existing refresh tokens for security
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  return { message: 'Password changed successfully. Please sign in again.' };
};

const changeEmail = async (userId, password, newEmail) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!(await user.comparePassword(password))) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  const normalized = newEmail.trim().toLowerCase();
  if (user.email === normalized) {
    throw new ApiError(400, 'New email must be different from current email');
  }

  const existing = await User.findOne({ email: normalized, _id: { $ne: userId } });
  if (existing) {
    throw new ApiError(409, 'Email is already registered');
  }

  user.email = normalized;
  await user.save();

  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
    createdAt: user.createdAt,
  };
};

module.exports = { deleteAccount, changePassword, changeEmail };
