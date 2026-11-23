const mongoose = require('mongoose');
const User = require('../models/user.model');
const Video = require('../models/video.model');
const RefreshToken = require('../models/refreshToken.model');
const VideoInteraction = require('../models/videoInteraction.model');
const Comment = require('../models/comment.model');
const Subscription = require('../models/subscription.model');
const Notification = require('../models/notification.model');
const Review = require('../models/review.model');
const Report = require('../models/report.model');
const { deleteVideoAssets } = require('./cloudinary.service');
const ApiError = require('../utils/apiError.util');

const deleteAccount = async (userId, password) => {
  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!(await user.comparePassword(password))) throw new ApiError(401, 'Current password is incorrect');

  const videos = await Video.find({ creator: userId }).select('_id cloudinaryPublicId').lean();
  const videoIds = videos.map((video) => video._id);
  const publicIds = videos.map((video) => video.cloudinaryPublicId).filter(Boolean);
  await deleteVideoAssets(publicIds);

  const comments = await Comment.find({
    $or: [{ user: userId }, { video: { $in: videoIds } }],
  }).select('_id').lean();
  const commentIds = comments.map((comment) => comment._id);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Video.deleteMany({ creator: userId }, { session });
      await VideoInteraction.deleteMany({
        $or: [{ user: userId }, { video: { $in: videoIds } }],
      }, { session });
      await Comment.deleteMany({
        $or: [{ user: userId }, { video: { $in: videoIds } }],
      }, { session });
      await Subscription.deleteMany({ $or: [{ subscriber: userId }, { creator: userId }] }, { session });
      await Notification.deleteMany({
        $or: [
          { recipient: userId },
          { video: { $in: videoIds } },
          { comment: { $in: commentIds } },
        ],
      }, { session });
      await Notification.updateMany({ actor: userId }, { $set: { actor: null } }, { session });
      await Review.deleteMany({ $or: [{ reviewer: userId }, { creator: userId }] }, { session });
      await Report.deleteMany({ $or: [{ reporter: userId }, { targetType: 'user', targetId: userId.toString() }] }, { session });
      await Report.updateMany({ resolvedBy: userId }, { $unset: { resolvedBy: 1 } }, { session });
      await RefreshToken.deleteMany({ user: userId }, { session });
      await User.deleteOne({ _id: userId }, { session });
    });
  } finally { await session.endSession(); }
};

const changePassword = async (userId, currentPassword, newPassword) => {
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    throw new ApiError(400, 'New password must be between 8 and 128 characters');
  }
  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!(await user.comparePassword(currentPassword))) {
    throw new ApiError(401, 'Current password is incorrect');
  }
  if (newPassword === currentPassword) {
    throw new ApiError(400, 'New password must be different from the current password');
  }

  user.password = newPassword;
  await user.save();
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return { message: 'Password changed successfully' };
};

const changeEmail = async (userId, password, nextEmail) => {
  if (typeof nextEmail !== 'string') throw new ApiError(400, 'Enter a valid email address');
  const email = nextEmail.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'Enter a valid email address');
  }

  const user = await User.findById(userId).select('+password');
  if (!user) throw new ApiError(404, 'User not found');
  if (!(await user.comparePassword(password))) throw new ApiError(401, 'Current password is incorrect');
  if (user.email.toLowerCase() === email) throw new ApiError(400, 'Email is already in use');

  const existing = await User.findOne({ email, _id: { $ne: userId } });
  if (existing) throw new ApiError(409, 'Email is already registered');

  user.email = email;
  try {
    await user.save();
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'Email is already registered');
    throw error;
  }
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
  };
};

module.exports = { deleteAccount, changePassword, changeEmail };
