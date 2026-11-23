const express = require('express');
const { authenticate, optionalAuthenticate, requireCreator } = require('../middleware/auth.middleware');
const { getMyVideos } = require('../services/video.service');
const Video = require('../models/video.model');
const VideoInteraction = require('../models/videoInteraction.model');
const {
  handleListVideos,
  getVideoById,
  removeVideo,
} = require('../controllers/video.controller');
const {
  handleView,
  handleLike,
  handleGetInteraction,
  handleWatchLater,
  handleGetWatchLater,
  handleGetLiked,
  handleRecordHistory,
  handleGetHistory,
  handleClearHistory,
  handleRemoveHistoryItem,
  handleAddComment,
  handleGetComments,
  handleDeleteComment,
} = require('../controllers/interaction.controller');

const router = express.Router();

router.get('/mine', authenticate, requireCreator, async (req, res, next) => {
  try {
    const videos = await getMyVideos(req.user.id);
    res.status(200).json({ success: true, data: videos });
  } catch (error) { next(error); }
});

router.get('/mine/analytics', authenticate, requireCreator, async (req, res, next) => {
  try {
    const videos = await Video.find({ creator: req.user.id })
      .select('_id title views createdAt moderationStatus visibility')
      .sort({ createdAt: -1 })
      .lean();
    const videoIds = videos.map((video) => video._id);
    const engagement = videoIds.length
      ? await VideoInteraction.aggregate([
        { $match: { video: { $in: videoIds } } },
        { $group: {
          _id: '$video',
          likes: { $sum: { $cond: ['$liked', 1, 0] } },
          dislikes: { $sum: { $cond: ['$disliked', 1, 0] } },
        } },
      ])
      : [];
    const engagementByVideo = new Map(engagement.map((item) => [item._id.toString(), item]));
    const data = videos.map((video) => ({
      id: video._id.toString(),
      title: video.title,
      views: video.views,
      createdAt: video.createdAt,
      moderationStatus: video.moderationStatus,
      visibility: video.visibility,
      likes: engagementByVideo.get(video._id.toString())?.likes || 0,
      dislikes: engagementByVideo.get(video._id.toString())?.dislikes || 0,
    }));
    return res.status(200).json({
      success: true,
      data: {
        totalVideos: data.length,
        totalViews: data.reduce((total, video) => total + (video.views || 0), 0),
        totalLikes: data.reduce((total, video) => total + video.likes, 0),
        totalDislikes: data.reduce((total, video) => total + video.dislikes, 0),
        videos: data,
      },
    });
  } catch (error) { next(error); }
});

router.get('/library/watch-later', authenticate, handleGetWatchLater);
router.get('/library/liked', authenticate, handleGetLiked);
router.get('/library/history', authenticate, handleGetHistory);
router.delete('/library/history', authenticate, handleClearHistory);
router.delete('/library/history/:id', authenticate, handleRemoveHistoryItem);
router.delete('/comments/:commentId', authenticate, handleDeleteComment);

router.get('/', handleListVideos);
router.get('/:id', optionalAuthenticate, getVideoById);
router.delete('/:id', authenticate, requireCreator, removeVideo);
router.post('/:id/view', handleView);
router.post('/:id/like', authenticate, handleLike);
router.get('/:id/interaction', optionalAuthenticate, handleGetInteraction);
router.post('/:id/watch-later', authenticate, handleWatchLater);
router.delete('/:id/watch-later', authenticate, handleWatchLater);
router.post('/:id/history', authenticate, handleRecordHistory);
router.get('/:id/comments', optionalAuthenticate, handleGetComments);
router.post('/:id/comments', authenticate, handleAddComment);
router.delete('/:id/comments/:commentId', authenticate, handleDeleteComment);

module.exports = router;
