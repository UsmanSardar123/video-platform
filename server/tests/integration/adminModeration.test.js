const request = require('supertest');
const mongoose = require('mongoose');

// Mock models and services before requiring app
jest.mock('../../models/video.model');
jest.mock('../../models/user.model');
jest.mock('../../models/comment.model');
jest.mock('../../models/videoInteraction.model');
jest.mock('../../models/adminAuditLog.model', () => ({ create: jest.fn().mockResolvedValue([]) }));
jest.mock('../../services/cloudinary.service', () => ({
  deleteVideoAssets: jest.fn().mockResolvedValue(true),
}));

// Mock auth middleware so we can control authentication and role
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
        req.user = { id: '507f1f77bcf86cd799439011', role: 'user', username: 'ordinaryuser' };
        return next();
      }
      if (auth === 'Bearer admin-token') {
        req.user = { id: '507f1f77bcf86cd799439099', role: 'admin', username: 'superadmin' };
        return next();
      }
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    },
    optionalAuthenticate: (req, res, next) => next(),
    requireAdmin: (req, res, next) => {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
      }
      next();
    },
    requireCreator: (req, res, next) => req.user?.role === 'creator' ? next() : res.status(403).json({ success: false }),
  };
});

const Video = require('../../models/video.model');
const { deleteVideoAssets } = require('../../services/cloudinary.service');
const app = require('../../app');

const mockChain = (val) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(val),
});

describe('Video Moderation & Administrative Control API', () => {
  const validVideoId = '507f1f77bcf86cd799439022';
  const invalidVideoId = 'not-a-valid-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authorization and Access Control', () => {
    test('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/videos');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('rejects ordinary user tokens with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/videos')
        .set('Authorization', 'Bearer user-token');
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Administrator privileges required/i);
    });

    test('allows authenticated admin token to access moderation endpoints', async () => {
      Video.find.mockReturnValue(mockChain([]));
      Video.countDocuments.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/admin/videos')
        .set('Authorization', 'Bearer admin-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/admin/videos', () => {
    test('filters videos by moderationStatus and populates creator', async () => {
      const mockVideos = [
        {
          _id: new mongoose.Types.ObjectId(validVideoId),
          title: 'Review Video',
          moderationStatus: 'pending',
          creator: { username: 'creator1', fullName: 'Creator One' },
        },
      ];
      Video.find.mockReturnValue(mockChain(mockVideos));
      Video.countDocuments.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/admin/videos?moderationStatus=pending')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Review Video');
      expect(res.body.data[0].moderationStatus).toBe('pending');
      expect(Video.find).toHaveBeenCalledWith(expect.objectContaining({ moderationStatus: 'pending' }));
    });
  });

  describe('PATCH /api/admin/videos/:id/approve', () => {
    test('rejects invalid MongoDB ID with 400', async () => {
      const res = await request(app)
        .patch(`/api/admin/videos/${invalidVideoId}/approve`)
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid video ID/i);
    });

    test('returns 404 if video is not found', async () => {
      Video.findById.mockResolvedValue(null);

      const res = await request(app)
        .patch(`/api/admin/videos/${validVideoId}/approve`)
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Video not found/i);
    });

    test('successfully approves video, resets moderationReason and sets visibility to public', async () => {
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(validVideoId),
        title: 'Pending Video',
        moderationStatus: 'pending',
        visibility: 'private',
        moderationReason: 'Previous issue',
        save: jest.fn().mockResolvedValue(true),
      };
      Video.findById
        .mockResolvedValueOnce(mockDoc)
        .mockReturnValueOnce(mockChain({
          _id: mockDoc._id,
          title: mockDoc.title,
          moderationStatus: 'approved',
          visibility: 'public',
          moderationReason: '',
        }));

      const res = await request(app)
        .patch(`/api/admin/videos/${validVideoId}/approve`)
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(mockDoc.moderationStatus).toBe('approved');
      expect(mockDoc.visibility).toBe('public');
      expect(mockDoc.moderationReason).toBe('');
      expect(mockDoc.save).toHaveBeenCalled();
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/approved successfully/i);
    });
  });

  describe('PATCH /api/admin/videos/:id/reject', () => {
    test('requires a rejection reason of at least 3 characters', async () => {
      const res = await request(app)
        .patch(`/api/admin/videos/${validVideoId}/reject`)
        .set('Authorization', 'Bearer admin-token')
        .send({ reason: '' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/rejection reason is required/i);
    });

    test('rejects reasons that are too long (> 500 chars)', async () => {
      const res = await request(app)
        .patch(`/api/admin/videos/${validVideoId}/reject`)
        .set('Authorization', 'Bearer admin-token')
        .send({ reason: 'a'.repeat(501) });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot exceed 500 characters/i);
    });

    test('successfully rejects video, records reason, and hides from public feed', async () => {
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(validVideoId),
        title: 'Violating Video',
        moderationStatus: 'approved',
        visibility: 'public',
        save: jest.fn().mockResolvedValue(true),
      };
      Video.findById
        .mockResolvedValueOnce(mockDoc)
        .mockReturnValueOnce(mockChain({
          _id: mockDoc._id,
          title: mockDoc.title,
          moderationStatus: 'rejected',
          visibility: 'private',
          moderationReason: 'Copyright infringement reported by copyright owner',
        }));

      const res = await request(app)
        .patch(`/api/admin/videos/${validVideoId}/reject`)
        .set('Authorization', 'Bearer admin-token')
        .send({ reason: 'Copyright infringement reported by copyright owner' });

      expect(res.status).toBe(200);
      expect(mockDoc.moderationStatus).toBe('rejected');
      expect(mockDoc.visibility).toBe('private');
      expect(mockDoc.moderationReason).toBe('Copyright infringement reported by copyright owner');
      expect(mockDoc.save).toHaveBeenCalled();
      expect(res.body.success).toBe(true);
    });
  });

  describe('PATCH /api/admin/videos/:id/visibility', () => {
    test('rejects invalid visibility options', async () => {
      const res = await request(app)
        .patch(`/api/admin/videos/${validVideoId}/visibility`)
        .set('Authorization', 'Bearer admin-token')
        .send({ visibility: 'secret_hidden' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Invalid visibility value/i);
    });

    test('updates visibility to private or public', async () => {
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(validVideoId),
        visibility: 'public',
        save: jest.fn().mockResolvedValue(true),
      };
      Video.findById
        .mockResolvedValueOnce(mockDoc)
        .mockReturnValueOnce(mockChain({ _id: mockDoc._id, visibility: 'private' }));

      const res = await request(app)
        .patch(`/api/admin/videos/${validVideoId}/visibility`)
        .set('Authorization', 'Bearer admin-token')
        .send({ visibility: 'private' });

      expect(res.status).toBe(200);
      expect(mockDoc.visibility).toBe('private');
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/admin/videos/:id', () => {
    test('returns 404 if target video is not found', async () => {
      Video.findById.mockResolvedValue(null);

      const res = await request(app)
        .delete(`/api/admin/videos/${validVideoId}`)
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(404);
    });

    test('deletes Cloudinary asset when present and removes video record', async () => {
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(validVideoId),
        title: 'Video with Cloudinary Asset',
        sourceType: 'cloudinary',
        cloudinaryPublicId: 'streanub/user_123/clip_abc-123',
      };
      Video.findById.mockResolvedValue(mockDoc);
      Video.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete(`/api/admin/videos/${validVideoId}`)
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(deleteVideoAssets).toHaveBeenCalledWith(['streanub/user_123/clip_abc-123']);
      expect(Video.deleteOne).toHaveBeenCalledWith({ _id: mockDoc._id });
      expect(res.body.data.storageRemoved).toBe(true);
    });

    test('safely deletes external video without attempting Cloudinary deletion', async () => {
      const mockDoc = {
        _id: new mongoose.Types.ObjectId(validVideoId),
        title: 'YouTube Video',
        sourceType: 'youtube',
      };
      Video.findById.mockResolvedValue(mockDoc);
      Video.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete(`/api/admin/videos/${validVideoId}`)
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(deleteVideoAssets).not.toHaveBeenCalled();
      expect(Video.deleteOne).toHaveBeenCalledWith({ _id: mockDoc._id });
    });
  });
});
