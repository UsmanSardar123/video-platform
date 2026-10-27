
const Video = require('../models/video.model');
const ApiError = require('../utils/apiError.util');
const mongoose = require('mongoose');
const { deleteVideo } = require('../services/video.service');

// GET /api/videos
const getVideos = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    const filter = { visibility: 'public' };

    if (req.query.creator && typeof req.query.creator === 'string') {
      const creatorId = req.query.creator.trim();
      if (mongoose.Types.ObjectId.isValid(creatorId)) {
        filter.creator = new mongoose.Types.ObjectId(creatorId);
      }
    }

    if (req.query.category && typeof req.query.category === 'string') {
      const cat = req.query.category.trim().slice(0, 60);
      if (cat && cat.toLowerCase() !== 'all') {
        if (cat.toLowerCase() === 'other') {
          filter.$or = [
            { category: new RegExp('^other$', 'i') },
            { category: new RegExp('^general$', 'i') },
            { category: { $exists: false } },
            { category: null },
            { category: '' },
          ];
        } else {
          const escaped = cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          filter.category = new RegExp(`^${escaped}$`, 'i');
        }
      }
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

    res.status(200).json({
      success: true,
      data: videos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/videos/:id
const getVideoById = async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
      return next(new ApiError(400, 'Invalid video ID'));
    }

    const visibilityFilter = req.user
      ? { $or: [{ visibility: { $in: ['public', 'unlisted'] } }, { creator: new mongoose.Types.ObjectId(req.user.id) }] }
      : { visibility: 'public' };
    const video = await Video.findOne({ _id: req.params.id, ...visibilityFilter })
      .populate('creator', 'username fullName avatar')
      .lean();

    if (!video) {
      return next(new ApiError(404, 'Video not found'));
    }

    res.status(200).json({
      success: true,
      data: video,
    });
  } catch (error) {
    next(error);
  }
};

const removeVideo = async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return next(new ApiError(400, 'Invalid video ID'));
    await deleteVideo(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: 'Video deleted successfully' });
  } catch (error) { next(error); }
};

module.exports = {
  getVideos,
  getVideoById,
  removeVideo,
};
