
const ApiError = require('../utils/apiError.util');

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = Number.isInteger(err.statusCode)
    ? err.statusCode
    : 500;

  if (statusCode >= 500) console.error('Unhandled application error');

  res.status(statusCode).json({
    success: false,
    statusCode,
    message: statusCode >= 500 ? 'Internal Server Error' : err.message || 'Request failed',
    stack: undefined,
    ...(Array.isArray(err.errors) && err.errors.length
      ? { errors: err.errors }
      : {}),
  });
};

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
