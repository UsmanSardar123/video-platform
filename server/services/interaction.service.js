const mongoose = require('mongoose');
const Video = require('../models/video.model');
const VideoInteraction = require('../models/videoInteraction.model');
const Comment = require('../models/comment.model');
const ApiError = require('../utils/apiError.util');
const { notifyNewComment } = require('./notificationEvents.service');

const canAccessVideo = (videoId, userId) => Video.exists({
  _id: videoId,
  $or: [
    { visibility: 'public', moderationStatus: 'approved' },
    { visibility: 'unlisted', moderationStatus: 'approved' },
    ...(userId ? [{ creator: userId }] : []),
  ],
});

const incrementViewCount = async (videoId) => {
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }
  const video = await Video.findOneAndUpdate(
    {
      _id: videoId,
      visibility: { $in: ['public', 'unlisted'] },
      moderationStatus: 'approved',
    },
    { $inc: { views: 1 } },
    { new: true }
  ).lean();
  if (!video) throw new ApiError(404, 'Video not found');
  return video.views;
};

const getLikeCount = async (videoId) => {
  return VideoInteraction.countDocuments({ video: videoId, liked: true });
};

const setVideoLike = async (userId, videoId, action) => {
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }

  if (!(await canAccessVideo(videoId, userId))) throw new ApiError(404, 'Video not found');

  let update = {};
  if (action === 'like') {
    update = { liked: true, disliked: false };
  } else if (action === 'dislike') {
    update = { liked: false, disliked: true };
  } else {
    update = { liked: false, disliked: false };
  }

  await VideoInteraction.findOneAndUpdate(
    { user: userId, video: videoId },
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const likeCount = await getLikeCount(videoId);
  return {
    liked: action === 'like',
    disliked: action === 'dislike',
    likeCount,
  };
};

const getVideoInteraction = async (userId, videoId) => {
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }

  if (!(await canAccessVideo(videoId, userId))) throw new ApiError(404, 'Video not found');

  const [interaction, likeCount] = await Promise.all([
    userId
      ? VideoInteraction.findOne({ user: userId, video: videoId }).lean()
      : null,
    getLikeCount(videoId),
  ]);

  return {
    liked: Boolean(interaction?.liked),
    disliked: Boolean(interaction?.disliked),
    watchLater: Boolean(interaction?.watchLater),
    likeCount,
  };
};

const setWatchLater = async (userId, videoId, save) => {
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }

  if (!(await canAccessVideo(videoId, userId))) throw new ApiError(404, 'Video not found');

  await VideoInteraction.findOneAndUpdate(
    { user: userId, video: videoId },
    { $set: { watchLater: Boolean(save) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { watchLater: Boolean(save) };
};

const getWatchLaterVideos = async (userId) => {
  const interactions = await VideoInteraction.find({
    user: userId,
    watchLater: true,
  })
    .sort({ updatedAt: -1 })
    .populate({
      path: 'video',
      populate: { path: 'creator', select: 'username fullName avatar' },
    })
    .lean();

  return interactions
    .map((item) => item.video)
    .filter((v) => v && v.visibility === 'public' && v.moderationStatus === 'approved');
};

const getLikedVideos = async (userId) => {
  const interactions = await VideoInteraction.find({
    user: userId,
    liked: true,
  })
    .sort({ updatedAt: -1 })
    .populate({
      path: 'video',
      populate: { path: 'creator', select: 'username fullName avatar' },
    })
    .lean();

  return interactions
    .map((item) => item.video)
    .filter((v) => v && v.visibility === 'public' && v.moderationStatus === 'approved');
};

const recordHistory = async (userId, videoId) => {
  if (!mongoose.Types.ObjectId.isValid(videoId)) throw new ApiError(400, 'Invalid video ID');
  if (!(await canAccessVideo(videoId, userId))) throw new ApiError(404, 'Video not found');

  await VideoInteraction.findOneAndUpdate(
    { user: userId, video: videoId },
    { $set: { watchedAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const getHistory = async (userId) => {
  const interactions = await VideoInteraction.find({
    user: userId,
    watchedAt: { $ne: null },
  })
    .sort({ watchedAt: -1 })
    .limit(50)
    .populate({
      path: 'video',
      populate: { path: 'creator', select: 'username fullName avatar' },
    })
    .lean();

  return interactions
    .map((item) => ({
      ...item.video,
      watchedAt: item.watchedAt,
    }))
    .filter((v) => v && v.visibility === 'public' && v.moderationStatus === 'approved');
};

const clearHistory = async (userId) => {
  await VideoInteraction.updateMany(
    { user: userId },
    { $set: { watchedAt: null } }
  );
};

const removeHistoryItem = async (userId, videoId) => {
  if (!mongoose.Types.ObjectId.isValid(videoId)) return;
  await VideoInteraction.updateOne(
    { user: userId, video: videoId },
    { $set: { watchedAt: null } }
  );
};

// Comments
const addComment = async (userId, videoId, text) => {
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }
  if (typeof text !== 'string') {
    throw new ApiError(400, 'Comment text is required');
  }
  const trimmed = text.trim();
  if (!trimmed) throw new ApiError(400, 'Comment text is required');
  if (trimmed.length > 1000) throw new ApiError(400, 'Comment text exceeds 1000 characters');

  if (!(await canAccessVideo(videoId, userId))) throw new ApiError(404, 'Video not found');

  const comment = await Comment.create({
    video: videoId,
    user: userId,
    text: trimmed,
  });

  // Never throws, so a notification problem cannot fail the comment.
  await notifyNewComment({
    commentId: comment._id,
    videoId,
    commenterId: userId,
    text: trimmed,
  });

  return Comment.findById(comment._id)
    .populate('user', 'username fullName avatar')
    .lean();
};

const getComments = async (videoId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }

  if (!(await canAccessVideo(videoId, userId))) throw new ApiError(404, 'Video not found');

  return Comment.find({ video: videoId })
    .populate('user', 'username fullName avatar')
    .sort({ createdAt: -1 })
    .lean();
};

const deleteComment = async (userId, commentId, videoId) => {
  if (!mongoose.Types.ObjectId.isValid(commentId)) {
    throw new ApiError(400, 'Invalid comment ID');
  }
  if (videoId !== undefined && !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, 'Invalid video ID');
  }

  const filter = {
    _id: commentId,
    user: userId,
    ...(videoId ? { video: videoId } : {}),
  };
  const comment = await Comment.findOneAndDelete(filter);
  if (!comment) throw new ApiError(404, 'Comment not found');
};

module.exports = {
  incrementViewCount,
  setVideoLike,
  getVideoInteraction,
  setWatchLater,
  getWatchLaterVideos,
  getLikedVideos,
  recordHistory,
  getHistory,
  clearHistory,
  removeHistoryItem,
  addComment,
  getComments,
  deleteComment,
  getLikeCount,
};
