
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const videoRoutes = require('./routes/video.routes');
const uploadRoutes = require('./routes/upload.routes');
const externalVideoRoutes = require('./routes/externalVideo.routes');
const searchRoutes = require('./routes/search.routes');

const { requestLogger } = require('./middleware/logger.middleware');
const { errorHandler } = require('./middleware/error.middleware');
const ApiError = require('./utils/apiError.util');
const ApiResponse = require('./utils/apiResponse.util');

const app = express();

app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8081')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isLocalExpoWebOrigin = (origin) => {
  if (process.env.NODE_ENV === 'production' || !origin) return false;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || !['8081', '19006'].includes(url.port)) return false;
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return true;
    const octets = url.hostname.split('.').map(Number);
    if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false;
    return octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168);
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || isLocalExpoWebOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
    },
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(requestLogger);

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    ...new ApiResponse(200, {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    }, 'API is healthy'),
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// User profile routes
app.use('/api/users', userRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/external-videos', externalVideoRoutes);
app.use('/api/search', searchRoutes);

// Handle unknown routes
app.use((req, res, next) => {
  next(
    new ApiError(
      404,
      `Route not found: ${req.method} ${req.originalUrl}`
    )
  );
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
