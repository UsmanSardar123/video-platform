
const express = require('express');
const { authenticate, optionalAuthenticate } = require('../middleware/auth.middleware');
const { getMyVideos } = require('../services/video.service');
const {
  getVideos,
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

router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const videos = await getMyVideos(req.user.id);
    res.status(200).json({ success: true, data: videos });
  } catch (error) { next(error); }
});

// Library endpoints (must be defined before /:id)
router.get('/library/watch-later', authenticate, handleGetWatchLater);
router.get('/library/liked', authenticate, handleGetLiked);
router.get('/library/history', authenticate, handleGetHistory);
router.delete('/library/history', authenticate, handleClearHistory);
router.delete('/library/history/:id', authenticate, handleRemoveHistoryItem);
router.delete('/comments/:commentId', authenticate, handleDeleteComment);

router.get('/', getVideos);

// Video detail and actions
router.get('/:id', optionalAuthenticate, getVideoById);
router.delete('/:id', authenticate, removeVideo);
router.post('/:id/view', handleView);
router.post('/:id/like', authenticate, handleLike);
router.get('/:id/interaction', optionalAuthenticate, handleGetInteraction);
router.post('/:id/watch-later', authenticate, handleWatchLater);
router.delete('/:id/watch-later', authenticate, handleWatchLater);
router.post('/:id/history', authenticate, handleRecordHistory);
router.get('/:id/comments', handleGetComments);
router.post('/:id/comments', authenticate, handleAddComment);

module.exports = router;
