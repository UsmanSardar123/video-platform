
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const validateEnv = () => {
  const required = ['MONGODB_URI'];

  if (process.env.NODE_ENV !== 'test') {
    required.push('JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET');
  }

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  if (process.env.NODE_ENV !== 'test') {
    const secrets = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
    ];

    for (const key of secrets) {
      if (
        process.env[key] &&
        process.env[key].length < 32
      ) {
        throw new Error(`${key} must be at least 32 characters long`);
      }
    }

    const cloudinaryKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
    const invalidCloudinary = cloudinaryKeys.filter(
      (k) => !process.env[k] || process.env[k].startsWith('your_') || process.env[k].trim() === ''
    );
    if (invalidCloudinary.length > 0) {
      console.warn(
        `[WARNING] Cloudinary credentials not fully configured in server/.env: ${invalidCloudinary.join(', ')}. Local device video uploads will return an explicit 503 error identifying these variables until real credentials are provided.`
      );
    }
  }
};

module.exports = { validateEnv };
