const ApiError = require('../utils/apiError.util');

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert generic Error to ApiError if not already an ApiError instance
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    const message = isProduction && statusCode === 500
      ? 'Internal Server Error'
      : (error.message || 'Something went wrong');

    error = new ApiError(statusCode, message, error?.errors || [], err.stack);
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
