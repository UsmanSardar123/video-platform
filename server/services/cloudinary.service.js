const crypto = require('crypto');
const cloudinary = require('../config/cloudinary.config');
const ApiError = require('../utils/apiError.util');

const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const ALLOWED_FORMATS = ['mp4', 'mov', 'm4v', 'webm'];

const isPlaceholderCredential = (val) => {
  if (!val || typeof val !== 'string') return true;
  const lower = val.trim().toLowerCase();
  return (
    lower === '' ||
    lower.startsWith('your_') ||
    lower.includes('placeholder') ||
    lower.includes('dummy') ||
    lower === 'null' ||
    lower === 'undefined'
  );
};

const getMissingCloudinaryCredentials = () => {
  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = process.env;

  const missing = [];
  if (isPlaceholderCredential(cloudName)) missing.push('CLOUDINARY_CLOUD_NAME');
  if (isPlaceholderCredential(apiKey)) missing.push('CLOUDINARY_API_KEY');
  if (isPlaceholderCredential(apiSecret)) missing.push('CLOUDINARY_API_SECRET');
  return missing;
};

const isCloudinaryConfigured = () => getMissingCloudinaryCredentials().length === 0;

const createUploadAuthorization = (userId) => {
  const missing = getMissingCloudinaryCredentials();
  if (missing.length > 0) {
    throw new ApiError(
      503,
      `Cloudinary upload is not configured. Missing or placeholder environment variable(s) in server/.env: ${missing.join(', ')}`
    );
  }

  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = process.env;

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
  const cleanFormat = String(format || 'mp4').toLowerCase();
  if (!ALLOWED_FORMATS.includes(cleanFormat)) {
    throw new ApiError(400, 'Video format is not supported');
  }

  const missing = getMissingCloudinaryCredentials();
  if (missing.length > 0) {
    throw new ApiError(
      503,
      `Cloudinary video storage is not configured. Missing or placeholder environment variable(s) in server/.env: ${missing.join(', ')}`
    );
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
    const httpCode = error.http_code || error.error?.http_code || error.statusCode;
    const errorMsg = error.message || error.error?.message || 'Cloudinary verification failed';
    if (httpCode === 404 || httpCode === 400) {
      throw new ApiError(400, 'Uploaded video was not found in Cloudinary');
    }
    if (httpCode === 401 || httpCode === 403) {
      throw new ApiError(502, `Cloudinary storage authentication failed: CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET is invalid (${errorMsg})`);
    }
    throw new ApiError(502, `Cloudinary service error: ${errorMsg}`);
  }
};

const deleteVideoAssets = async (publicIds) => {
  if (!publicIds.length) return;
  const missing = getMissingCloudinaryCredentials();
  if (missing.length > 0) {
    throw new ApiError(
      503,
      `Cloudinary video storage is not configured for deletion. Missing or placeholder environment variable(s) in server/.env: ${missing.join(', ')}`
    );
  }
  try {
    const response = await cloudinary.api.delete_resources(publicIds, {
      resource_type: 'video', type: 'upload', invalidate: true,
    });
    const outcomes = response.deleted || {};
    const failed = publicIds.some((id) => !['deleted', 'not found'].includes(outcomes[id]));
    if (failed) throw new ApiError(502, 'One or more video files could not be removed from storage');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const errorMsg = error.message || error.error?.message || 'Cloudinary deletion failed';
    throw new ApiError(502, `Cloudinary deletion error: ${errorMsg}`);
  }
};

const ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const createAvatarUploadAuthorization = (userId) => {
  const missing = getMissingCloudinaryCredentials();
  if (missing.length > 0) {
    throw new ApiError(
      503,
      `Cloudinary upload is not configured. Missing or placeholder environment variable(s) in server/.env: ${missing.join(', ')}`
    );
  }

  const {
    CLOUDINARY_CLOUD_NAME: cloudName,
    CLOUDINARY_API_KEY: apiKey,
    CLOUDINARY_API_SECRET: apiSecret,
  } = process.env;

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `streanub/user_${userId}/avatar_${crypto.randomUUID()}`;

  const params = {
    allowed_formats: ALLOWED_IMAGE_FORMATS.join(','),
    overwrite: false,
    public_id: publicId,
    timestamp,
  };
  return {
    cloudName,
    apiKey,
    timestamp,
    publicId,
    resourceType: 'image',
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    signature: cloudinary.utils.api_sign_request(params, apiSecret),
    allowedFormats: ALLOWED_IMAGE_FORMATS,
    maxBytes: MAX_IMAGE_BYTES,
    expiresAt: new Date((timestamp + 3600) * 1000).toISOString(),
  };
};

module.exports = {
  createUploadAuthorization,
  createAvatarUploadAuthorization,
  verifyUploadedAsset,
  deleteVideoAssets,
  isCloudinaryConfigured,
  getMissingCloudinaryCredentials,
  MAX_VIDEO_BYTES,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_FORMATS,
};
