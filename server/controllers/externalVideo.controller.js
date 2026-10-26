const { createExternalVideo } = require('../services/externalVideo.service');

const submit = async (req, res, next) => {
  try {
    const video = await createExternalVideo(req.user.id, req.body);
    res.status(201).json({ success: true, message: 'External video saved successfully', data: video });
  } catch (error) { next(error); }
};

module.exports = { submit };
