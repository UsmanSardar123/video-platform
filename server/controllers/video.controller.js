const videoService = require('../services/video.service');
const Video = require('../models/video.model');
const ApiError = require('../utils/apiError.util');
const mongoose = require('mongoose');

const handleListVideos = async (req, res, next) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    const result = await videoService.listPublicVideos({
      page,
      limit,
      category: req.query.category,
      creator: req.query.creator,
    });
    res.status(200).json({
      success: true,
      data: result.videos,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getVideoById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, 'Invalid video ID');
    const filter = req.user
      ? {
        _id: req.params.id,
        $or: [
          { creator: new mongoose.Types.ObjectId(req.user.id) },
          { visibility: { $in: ['public', 'unlisted'] }, moderationStatus: 'approved' },
        ],
      }
      : { _id: req.params.id, visibility: { $in: ['public', 'unlisted'] }, moderationStatus: 'approved' };
    const video = await Video.findOne(filter)
      .populate('creator', 'username fullName avatar')
      .lean();
    if (!video) throw new ApiError(404, 'Video not found');
    res.status(200).json({ success: true, data: video });
  } catch (error) {
    next(error);
  }
};

const removeVideo = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ApiError(400, 'Invalid video ID');
    await videoService.deleteVideo(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { handleListVideos, getVideos: handleListVideos, getVideoById, removeVideo };
