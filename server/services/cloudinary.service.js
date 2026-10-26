const crypto = require('crypto');
const cloudinary = require('../config/cloudinary.config');
const ApiError = require('../utils/apiError.util');

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const ALLOWED_FORMATS = ['mp4', 'mov', 'm4v', 'webm'];

const createUploadAuthorization = (userId) => {
  const { CLOUDINARY_CLOUD_NAME: cloudName, CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret } = process.env;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new ApiError(503, 'Video uploads are not configured');
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `streanub/user_${userId}/clip_${crypto.randomUUID()}`;
  const params = {
    allowed_formats: ALLOWED_FORMATS.join(','),
    overwrite: false,
    public_id: publicId,
    timestamp,
  };
  return {
    cloudName,
    apiKey,
    timestamp,
    publicId,
    resourceType: 'video',
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    signature: cloudinary.utils.api_sign_request(params, apiSecret),
    allowedFormats: ALLOWED_FORMATS,
    maxBytes: MAX_VIDEO_BYTES,
    expiresAt: new Date((timestamp + 3600) * 1000).toISOString(),
  };
};

const verifyUploadedAsset = async ({ userId, publicId, format }) => {
  const prefix = `streanub/user_${userId}/clip_`;
  if (typeof publicId !== 'string' || !publicId.startsWith(prefix) ||
      !/^[a-f\d-]{36}$/.test(publicId.slice(prefix.length))) {
    throw new ApiError(400, 'Upload identifier is invalid');
  }
  if (!ALLOWED_FORMATS.includes(String(format).toLowerCase())) {
    throw new ApiError(400, 'Video format is not supported');
  }
  try {
    const asset = await cloudinary.api.resource(publicId, {
      resource_type: 'video',
      type: 'upload',
    });
    if (asset.public_id !== publicId || asset.resource_type !== 'video' ||
        !ALLOWED_FORMATS.includes(String(asset.format).toLowerCase()) ||
        asset.bytes > MAX_VIDEO_BYTES || !asset.secure_url?.startsWith('https://')) {
      throw new ApiError(400, 'Uploaded asset failed verification');
    }
    return asset;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.http_code === 404 || error.http_code === 400) {
      throw new ApiError(400, 'Uploaded video was not found in Cloudinary');
    }
    throw error;
  }
};

const deleteVideoAssets = async (publicIds) => {
  if (!publicIds.length) return;
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new ApiError(503, 'Video storage is not configured for deletion');
  }
  const response = await cloudinary.api.delete_resources(publicIds, {
    resource_type: 'video', type: 'upload', invalidate: true,
  });
  const outcomes = response.deleted || {};
  const failed = publicIds.some((id) => !['deleted', 'not found'].includes(outcomes[id]));
  if (failed) throw new ApiError(502, 'One or more video files could not be removed from storage');
};

module.exports = { createUploadAuthorization, verifyUploadedAsset, deleteVideoAssets, MAX_VIDEO_BYTES };
