const interactionService = require('../services/interaction.service');

const handleView = async (req, res, next) => {
  try {
    const views = await interactionService.incrementViewCount(req.params.id);
    res.status(200).json({ success: true, data: { views } });
  } catch (error) { next(error); }
};

const handleLike = async (req, res, next) => {
  try {
    const action = req.body.action || 'like'; // 'like', 'dislike', 'none'
    const result = await interactionService.setVideoLike(req.user.id, req.params.id, action);
    res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

const handleGetInteraction = async (req, res, next) => {
  try {
    const result = await interactionService.getVideoInteraction(req.user?.id, req.params.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

const handleWatchLater = async (req, res, next) => {
  try {
    const save = req.method === 'POST';
    const result = await interactionService.setWatchLater(req.user.id, req.params.id, save);
    res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

const handleGetWatchLater = async (req, res, next) => {
  try {
    const videos = await interactionService.getWatchLaterVideos(req.user.id);
    res.status(200).json({ success: true, data: videos });
  } catch (error) { next(error); }
};

const handleGetLiked = async (req, res, next) => {
  try {
    const videos = await interactionService.getLikedVideos(req.user.id);
    res.status(200).json({ success: true, data: videos });
  } catch (error) { next(error); }
};

const handleRecordHistory = async (req, res, next) => {
  try {
    await interactionService.recordHistory(req.user.id, req.params.id);
    res.status(200).json({ success: true });
  } catch (error) { next(error); }
};

const handleGetHistory = async (req, res, next) => {
  try {
    const videos = await interactionService.getHistory(req.user.id);
    res.status(200).json({ success: true, data: videos });
  } catch (error) { next(error); }
};

const handleClearHistory = async (req, res, next) => {
  try {
    await interactionService.clearHistory(req.user.id);
    res.status(200).json({ success: true, message: 'History cleared' });
  } catch (error) { next(error); }
};

const handleRemoveHistoryItem = async (req, res, next) => {
  try {
    await interactionService.removeHistoryItem(req.user.id, req.params.id);
    res.status(200).json({ success: true, message: 'History item removed' });
  } catch (error) { next(error); }
};

const handleAddComment = async (req, res, next) => {
  try {
    const comment = await interactionService.addComment(req.user.id, req.params.id, req.body.text);
    res.status(201).json({ success: true, data: comment });
  } catch (error) { next(error); }
};

const handleGetComments = async (req, res, next) => {
  try {
    const comments = await interactionService.getComments(req.params.id, req.user?.id);
    res.status(200).json({ success: true, data: comments });
  } catch (error) { next(error); }
};

const handleDeleteComment = async (req, res, next) => {
  try {
    await interactionService.deleteComment(req.user.id, req.params.commentId);
    res.status(200).json({ success: true, message: 'Comment deleted' });
  } catch (error) { next(error); }
};

module.exports = {
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
};
