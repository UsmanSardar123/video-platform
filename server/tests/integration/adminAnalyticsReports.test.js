const request = require('supertest');
const mockMongoose = require('mongoose');

// Mock models and services before requiring app
jest.mock('../../models/video.model');
jest.mock('../../models/user.model');
jest.mock('../../models/comment.model');
jest.mock('../../models/subscription.model');
jest.mock('../../models/videoInteraction.model');
jest.mock('../../models/report.model');
jest.mock('../../services/cloudinary.service', () => ({
  deleteVideoAssets: jest.fn().mockResolvedValue(true),
}));

// Mock auth middleware so we control auth headers
jest.mock('../../middleware/auth.middleware', () => {
  return {
    authenticate: (req, res, next) => {
      const auth = req.headers.authorization;
      if (!auth) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }
      if (auth === 'Bearer invalid-token') {
        return res.status(401).json({ success: false, message: 'Invalid token' });
      }
      if (auth === 'Bearer user-token') {
        req.user = {
          _id: new mockMongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
          role: 'user',
          username: 'regular_user',
        };
        return next();
      }
      if (auth === 'Bearer admin-token') {
        req.user = {
          _id: new mockMongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
          role: 'admin',
          username: 'admin_user',
        };
        return next();
      }
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    },
    requireAdmin: (req, res, next) => {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied. Administrator privileges required.',
        });
      }
      next();
    },
    optionalAuthenticate: (req, res, next) => next(),
  };
});

const app = require('../../app');
const User = require('../../models/user.model');
const Video = require('../../models/video.model');
const Report = require('../../models/report.model');
const VideoInteraction = require('../../models/videoInteraction.model');
const Subscription = require('../../models/subscription.model');
const Comment = require('../../models/comment.model');

describe('Admin Analytics and Reporting API', () => {
  const adminAuth = 'Bearer admin-token';
  const userAuth = 'Bearer user-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Security and Access Control', () => {
    it('rejects unauthenticated requests to /api/admin/analytics with 401', async () => {
      const res = await request(app).get('/api/admin/analytics');
      expect(res.status).toBe(401);
    });

    it('rejects ordinary user tokens to /api/admin/analytics with 403', async () => {
      const res = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', userAuth);
      expect(res.status).toBe(403);
    });

    it('rejects unauthenticated requests to /api/admin/reports with 401', async () => {
      const res = await request(app).get('/api/admin/reports');
      expect(res.status).toBe(401);
    });

    it('rejects ordinary user tokens to /api/admin/reports with 403', async () => {
      const res = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', userAuth);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/admin/analytics Date Range Validation', () => {
    it('rejects invalid startDate format with 400', async () => {
      const res = await request(app)
        .get('/api/admin/analytics?startDate=not-a-date')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid startDate/i);
    });

    it('rejects invalid endDate format with 400', async () => {
      const res = await request(app)
        .get('/api/admin/analytics?startDate=2026-10-01&endDate=invalid')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid endDate/i);
    });

    it('rejects startDate greater than endDate with 400', async () => {
      const res = await request(app)
        .get('/api/admin/analytics?startDate=2026-10-25&endDate=2026-10-10')
        .set('Authorization', adminAuth);
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/startDate cannot be after endDate/i);
    });
  });

  describe('GET /api/admin/analytics Aggregated Data', () => {
    it('successfully returns analytics telemetry with timeSeries, summary, and engagement metrics', async () => {
      User.countDocuments.mockResolvedValue(10);
      Video.countDocuments.mockResolvedValue(6);
      Video.aggregate.mockImplementation((pipeline) => {
        if (pipeline[0]?.$group?.totalViews) {
          return Promise.resolve([{ _id: null, totalViews: 18 }]);
        }
        if (pipeline[0]?.$group?._id === '$category') {
          return Promise.resolve([{ _id: 'Entertainment', count: 4, totalViews: 12 }]);
        }
        return Promise.resolve([{ _id: '2026-10-27', uploads: 2, views: 5 }]);
      });
      User.aggregate.mockResolvedValue([{ _id: '2026-10-27', newUsers: 3 }]);
      VideoInteraction.aggregate.mockResolvedValue([{ _id: '2026-10-27', views: 5, likes: 2 }]);
      VideoInteraction.countDocuments.mockResolvedValue(2);
      Comment.countDocuments.mockResolvedValue(0);
      Subscription.countDocuments.mockResolvedValue(2);
      Report.aggregate.mockResolvedValue([{ _id: 'pending', count: 1 }]);

      const res = await request(app)
        .get('/api/admin/analytics?period=7d')
        .set('Authorization', adminAuth);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.totalUsers).toBe(10);
      expect(res.body.data.summary.totalVideos).toBe(6);
      expect(res.body.data.summary.totalViews).toBe(18);
      expect(res.body.data.summary.engagement.totalLikes).toBe(2);
      expect(res.body.data.categories).toBeDefined();
      expect(Array.isArray(res.body.data.timeSeries)).toBe(true);
      expect(res.body.data.timeSeries.length).toBeGreaterThan(0);
    });
  });

  describe('Reports API Operations', () => {
    it('creates a new report via POST /api/admin/reports', async () => {
      const mockCreated = {
        _id: new mockMongoose.Types.ObjectId('507f1f77bcf86cd799439044'),
        targetType: 'video',
        targetId: new mockMongoose.Types.ObjectId('507f1f77bcf86cd799439022'),
        reason: 'inappropriate_content',
        status: 'pending',
        createdAt: new Date(),
      };
      Report.create.mockResolvedValue(mockCreated);

      const res = await request(app)
        .post('/api/admin/reports')
        .set('Authorization', adminAuth)
        .send({
          targetType: 'video',
          targetId: '507f1f77bcf86cd799439022',
          reason: 'inappropriate_content',
          details: 'Violates community guidelines',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetType).toBe('video');
    });

    it('rejects invalid report targetType with 400', async () => {
      const res = await request(app)
        .post('/api/admin/reports')
        .set('Authorization', adminAuth)
        .send({
          targetType: 'invalid_type',
          targetId: '507f1f77bcf86cd799439022',
          reason: 'spam',
        });

      expect(res.status).toBe(400);
    });

    it('updates report status and resolution notes via PATCH /api/admin/reports/:id', async () => {
      const mockReportDoc = {
        _id: new mockMongoose.Types.ObjectId('507f1f77bcf86cd799439044'),
        status: 'pending',
        resolutionNotes: '',
        save: jest.fn().mockResolvedValue(true),
      };

      Report.findById.mockImplementation((id) => {
        return {
          populate: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue({
            _id: mockReportDoc._id,
            status: 'resolved',
            resolutionNotes: 'Reviewed and video approved.',
          }),
        };
      });

      Report.findById.mockResolvedValueOnce(mockReportDoc);

      const res = await request(app)
        .patch('/api/admin/reports/507f1f77bcf86cd799439044')
        .set('Authorization', adminAuth)
        .send({
          status: 'resolved',
          resolutionNotes: 'Reviewed and video approved.',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockReportDoc.save).toHaveBeenCalled();
    });
  });
});
