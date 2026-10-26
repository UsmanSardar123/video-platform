const Video = require('../models/video.model');
const ApiError = require('../utils/apiError.util');
const { verifyUploadedAsset, deleteVideoAssets } = require('./cloudinary.service');

const completeUpload = async (userId, metadata) => {
  const asset = await verifyUploadedAsset({
    userId,
    publicId: metadata.publicId,
    format: metadata.format,
  });
  const existing = await Video.findOne({ cloudinaryPublicId: asset.public_id });
  if (existing) {
    if (existing.creator.toString() !== userId) {
      throw new ApiError(409, 'Video asset is already registered');
    }
    return existing;
  }
  try {
    return await Video.create({
      title: metadata.title,
      description: metadata.description,
      category: metadata.category,
      visibility: metadata.visibility,
      creator: userId,
      cloudinaryPublicId: asset.public_id,
      videoUrl: asset.secure_url,
      thumbnailUrl: asset.secure_url.replace('/video/upload/', '/video/upload/so_0/').replace(/\.[^.]+$/, '.jpg'),
      duration: Number.isFinite(asset.duration) ? asset.duration : 0,
      sourceType: 'cloudinary',
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicate = await Video.findOne({ cloudinaryPublicId: asset.public_id });
      if (duplicate?.creator.toString() === userId) return duplicate;
      throw new ApiError(409, 'Video asset is already registered');
    }
    throw error;
  }
};

const getMyVideos = (userId) => Video.find({ creator: userId })
  .sort({ createdAt: -1 }).lean();

const deleteVideo = async (userId, videoId) => {
  const video = await Video.findById(videoId);
  if (!video || video.creator.toString() !== userId) throw new ApiError(404, 'Video not found');
  if (video.cloudinaryPublicId) await deleteVideoAssets([video.cloudinaryPublicId]);
  await Video.deleteOne({ _id: video._id, creator: userId });
};

module.exports = { completeUpload, getMyVideos, deleteVideo };
