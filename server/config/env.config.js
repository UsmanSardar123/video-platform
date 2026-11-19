const path = require('path');
const dotenv = require('dotenv');

// Ensure environment variables are loaded from server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const validateEnv = () => {
  const critical = ['PORT', 'MONGODB_URI'];
  const missingCritical = critical.filter((key) => !process.env[key]);

  if (missingCritical.length > 0) {
    console.warn(`[WARNING] Critical environment variable(s) not set: ${missingCritical.join(', ')}`);
  }

  const optional = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ];
  const missingOptional = optional.filter((key) => !process.env[key]);

  if (missingOptional.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn(`[INFO] Optional environment variable(s) not set: ${missingOptional.join(', ')}`);
  }
};

module.exports = {
  validateEnv,
};
