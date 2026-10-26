
const express = require('express');
const { authenticate, optionalAuthenticate } = require('../middleware/auth.middleware');
const { getMyVideos } = require('../services/video.service');
const {
  getVideos,
  getVideoById,
  removeVideo,
} = require('../controllers/video.controller');

const router = express.Router();

router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const videos = await getMyVideos(req.user.id);
    res.status(200).json({ success: true, data: videos });
  } catch (error) { next(error); }
});

router.get('/', getVideos);
router.delete('/:id', authenticate, removeVideo);
router.get('/:id', optionalAuthenticate, getVideoById);

module.exports = router;
