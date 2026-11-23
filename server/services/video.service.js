const mongoose = require('mongoose');
const Video = require('../models/video.model');
const Comment = require('../models/comment.model');
const VideoInteraction = require('../models/videoInteraction.model');
const Notification = require('../models/notification.model');
const Report = require('../models/report.model');
const ApiError = require('../utils/apiError.util');
const { verifyUploadedAsset, deleteVideoAssets } = require('./cloudinary.service');
const { notifyNewVideo } = require('./notificationEvents.service');

const listPublicVideos = async ({ page, limit, category, creator }) => {
  if (!Number.isInteger(page) || page < 1) throw new ApiError(400, 'page must be a positive integer');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ApiError(400, 'limit must be an integer between 1 and 50');
  }

  const filter = { visibility: 'public', moderationStatus: 'approved' };
  if (typeof category === 'string' && category.trim() && category.toLowerCase() !== 'all') {
    if (category.trim().toLowerCase() === 'other') {
      filter.$and = [{ $or: [
        { category: /^other$/i },
        { category: /^general$/i },
        { category: { $exists: false } },
        { category: null },
        { category: '' },
      ] }];
    } else {
      filter.category = new RegExp(`^${category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
  }
  if (typeof creator === 'string' && creator.trim()) {
    const cleanCreator = creator.trim();
    if (!mongoose.Types.ObjectId.isValid(cleanCreator)) {
      throw new ApiError(400, 'Invalid creator ID');
    }
    filter.creator = cleanCreator;
  }

  const [videos, total] = await Promise.all([
    Video.find(filter)
      .populate('creator', 'username fullName avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Video.countDocuments(filter),
  ]);

  return { videos, page, limit, total, totalPages: Math.ceil(total / limit) };
};

const completeUpload = async (userId, metadata) => {
  const asset = await verifyUploadedAsset({
    userId,
    publicId: metadata.publicId,
    format: metadata.format,
  });
  const existing = await Video.findOne({ cloudinaryPublicId: asset.public_id });
  if (existing) {
    if (existing.creator.toString() !== userId) throw new ApiError(409, 'Video asset is already registered');
    return existing;
  }

  try {
    const video = await Video.create({
      title: metadata.title,
      description: metadata.description,
      category: metadata.category,
      visibility: metadata.visibility,
      creator: userId,
      cloudinaryPublicId: asset.public_id,
      videoUrl: asset.secure_url,
      thumbnailUrl: asset.secure_url.includes('/video/upload/')
        ? asset.secure_url.replace('/video/upload/', '/video/upload/so_0/').replace(/\.[^.]+$/, '.jpg')
        : (asset.thumbnail_url || ''),
      duration: Number.isFinite(asset.duration) ? asset.duration : 0,
      sourceType: 'cloudinary',
    });
    try { await notifyNewVideo(video); } catch { /* Notifications must not fail an upload. */ }
    return video;
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await Video.findOne({ cloudinaryPublicId: asset.public_id });
      if (duplicate?.creator.toString() === userId) return duplicate;
      throw new ApiError(409, 'Video asset is already registered');
    }
    throw error;
  }
};

const getMyVideos = (userId) => Video.find({ creator: userId }).sort({ createdAt: -1 }).lean();

const deleteVideo = async (userId, videoId) => {
  const video = await Video.findById(videoId);
  if (!video || video.creator.toString() !== userId) throw new ApiError(404, 'Video not found');
  if (video.cloudinaryPublicId) await deleteVideoAssets([video.cloudinaryPublicId]);
  await Video.deleteOne({ _id: video._id, creator: userId });

  // Best-effort cleanup of dependent records so deleted videos leave no orphans.
  await Promise.allSettled([
    Comment.deleteMany({ video: video._id }),
    VideoInteraction.deleteMany({ video: video._id }),
    Notification.deleteMany({ video: video._id }),
    Report.deleteMany({ targetType: 'video', targetId: video._id }),
  ]);
};

module.exports = { listPublicVideos, completeUpload, getMyVideos, deleteVideo };
