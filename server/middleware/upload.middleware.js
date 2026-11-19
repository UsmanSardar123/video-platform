// Streanub utilizes signed direct client-to-Cloudinary uploads to keep large video binaries off Express.
// This middleware provides an extensible pass-through handler for multipart upload validation.
const uploadMiddleware = (req, res, next) => next();

module.exports = uploadMiddleware;
module.exports.uploadMiddleware = uploadMiddleware;
