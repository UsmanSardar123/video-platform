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

module.exports = { deleteAccount };
