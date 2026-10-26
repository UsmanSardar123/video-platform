const cloudinaryService = require('../services/cloudinary.service');
const videoService = require('../services/video.service');

const authorize = (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: cloudinaryService.createUploadAuthorization(req.user.id) });
  } catch (error) { next(error); }
};

const complete = async (req, res, next) => {
  try {
    const video = await videoService.completeUpload(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Video uploaded successfully', data: video });
  } catch (error) { next(error); }
};

module.exports = { authorize, complete };
