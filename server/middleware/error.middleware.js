const ApiError = require('../utils/apiError.util');

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Normalize Mongoose / MongoDB operational errors to proper HTTP 4xx codes
  if (!(error instanceof ApiError)) {
    if (error?.name === 'CastError') {
      const field = error.path ? ` ${error.path}` : '';
      error = new ApiError(400, `Invalid${field} format`, [], err.stack);
    } else if (error?.name === 'ValidationError') {
      const details = Object.values(error.errors || {}).map((item) => ({
        field: item.path,
        message: item.message,
      }));
      error = new ApiError(400, details[0]?.message || 'Validation failed', details, err.stack);
    } else if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'resource';
      error = new ApiError(409, `${field} already exists`, [], err.stack);
    } else {
      const statusCode = error.statusCode || 500;
      const isProduction = process.env.NODE_ENV === 'production';
      const message = isProduction && statusCode === 500
        ? 'Internal Server Error'
        : (error.message || 'Something went wrong');

      error = new ApiError(statusCode, message, error?.errors || [], err.stack);
    }
  }

  const response = {
    statusCode: error.statusCode,
    success: false,
    message: error.message,
    errors: error.errors || [],
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  };

  return res.status(error.statusCode).json(response);
};

module.exports = errorHandler;
