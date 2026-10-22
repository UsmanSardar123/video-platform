const loggerMiddleware = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const duration = Date.now() - startTime;
    // Strip query parameters to avoid logging tokens or credentials
    const safeUrl = req.originalUrl.split('?')[0];
    console.log(`[${new Date().toISOString()}] ${req.method} ${safeUrl} ${res.statusCode} - ${duration}ms`);
  });

  next();
};

module.exports = loggerMiddleware;
