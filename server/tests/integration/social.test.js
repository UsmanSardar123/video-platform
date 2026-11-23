const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../../models/user.model', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../../models/video.model', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  exists: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../../models/subscription.model', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../../models/videoInteraction.model', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  updateOne: jest.fn(),
  updateMany: jest.fn(),
}));

jest.mock('../../models/comment.model', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
  findOneAndDelete: jest.fn(),
  deleteOne: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../../models/report.model', () => ({
  create: jest.fn(),
}));

jest.mock('../../models/notification.model', () => ({
  updateOne: jest.fn().mockResolvedValue({}),
  insertMany: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    if (req.headers.authorization === 'Bearer user-token') {
      req.user = { id: '507f1f77bcf86cd799439011', username: 'testuser' };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Authentication required' });
  },
  optionalAuthenticate: (req, _res, next) => {
    if (req.headers.authorization === 'Bearer user-token') {
      req.user = { id: '507f1f77bcf86cd799439011', username: 'testuser' };
    }
    next();
  },
  requireAdmin: (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ success: false }),
  requireCreator: (req, res, next) => req.user?.role === 'creator' ? next() : res.status(403).json({ success: false }),
}));

const User = require('../../models/user.model');
const Video = require('../../models/video.model');
const Subscription = require('../../models/subscription.model');
const VideoInteraction = require('../../models/videoInteraction.model');
const Comment = require('../../models/comment.model');
const Report = require('../../models/report.model');
const app = require('../../app');

const chain = (result) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

describe('Social, Subscriptions and Video Interactions', () => {
  const subscriberId = '507f1f77bcf86cd799439011';
  const creatorId = '507f191e810c19729de860ea';
  const videoId = '507f1f77bcf86cd799439012';

  beforeEach(() => {
    jest.clearAllMocks();
    Video.findOne.mockReturnValue(chain({
      _id: videoId,
      visibility: 'public',
      moderationStatus: 'approved',
    }));
    Video.exists.mockResolvedValue(true);
  });

  describe('Subscriptions', () => {
    test('1. an authenticated user can subscribe successfully', async () => {
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1', role: 'creator' }));
      Subscription.findOneAndUpdate.mockResolvedValue({});
      Subscription.countDocuments.mockResolvedValue(10);

      const response = await request(app)
        .post(`/api/subscriptions/${creatorId}`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(200);
      expect(response.body.data.subscribed).toBe(true);
      expect(response.body.data.subscriberCount).toBe(10);
    });

    test('2. the subscription is persisted in MongoDB using atomic $setOnInsert operator', async () => {
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1', role: 'creator' }));
      Subscription.findOneAndUpdate.mockResolvedValue({});
      Subscription.countDocuments.mockResolvedValue(1);

      await request(app)
        .post(`/api/subscriptions/${creatorId}`)
        .set('Authorization', 'Bearer user-token');

      expect(Subscription.findOneAndUpdate).toHaveBeenCalledWith(
        { subscriber: subscriberId, creator: creatorId },
        { $setOnInsert: { subscriber: subscriberId, creator: creatorId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    });

    test('3. the correct target user subscription count is updated', async () => {
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1', role: 'creator' }));
      Subscription.findOneAndUpdate.mockResolvedValue({});
      Subscription.countDocuments.mockResolvedValue(25);

      const response = await request(app)
        .post(`/api/subscriptions/${creatorId}`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(200);
      expect(response.body.data.subscriberCount).toBe(25);
      expect(Subscription.countDocuments).toHaveBeenCalledWith({ creator: creatorId });
    });

    test('4. duplicate subscription requests with code 11000 do not fail and remain idempotent', async () => {
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1', role: 'creator' }));
      const duplicateError = new Error('E11000 duplicate key error');
      duplicateError.code = 11000;
      Subscription.findOneAndUpdate.mockRejectedValue(duplicateError);
      Subscription.countDocuments.mockResolvedValue(10);

      const response = await request(app)
        .post(`/api/subscriptions/${creatorId}`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(200);
      expect(response.body.data.subscribed).toBe(true);
      expect(response.body.data.subscriberCount).toBe(10);
    });

    test('5. unsubscribing removes the relationship correctly', async () => {
      Subscription.deleteOne.mockResolvedValue({ deletedCount: 1 });
      Subscription.countDocuments.mockResolvedValue(9);

      const response = await request(app)
        .delete(`/api/subscriptions/${creatorId}`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(200);
      expect(response.body.data.subscribed).toBe(false);
      expect(response.body.data.subscriberCount).toBe(9);
      expect(Subscription.deleteOne).toHaveBeenCalledWith({
        subscriber: subscriberId,
        creator: creatorId,
      });
    });

    test('6. subscription counts remain consistent after subscribing and unsubscribing', async () => {
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1', role: 'creator' }));
      Subscription.findOneAndUpdate.mockResolvedValue({});
      Subscription.countDocuments.mockResolvedValueOnce(5);

      const subRes = await request(app)
        .post(`/api/subscriptions/${creatorId}`)
        .set('Authorization', 'Bearer user-token');
      expect(subRes.body.data.subscriberCount).toBe(5);

      Subscription.deleteOne.mockResolvedValue({ deletedCount: 1 });
      Subscription.countDocuments.mockResolvedValueOnce(4);

      const unsubRes = await request(app)
        .delete(`/api/subscriptions/${creatorId}`)
        .set('Authorization', 'Bearer user-token');
      expect(unsubRes.body.data.subscriberCount).toBe(4);
    });

    test('7. unauthenticated requests are rejected', async () => {
      const response = await request(app)
        .post(`/api/subscriptions/${creatorId}`);

      expect(response.status).toBe(401);
    });

    test('8. invalid target IDs are safely rejected with 400', async () => {
      const response = await request(app)
        .post('/api/subscriptions/invalid-not-an-id')
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid user ID');
    });

    test('9. subscribing to oneself is rejected with 400', async () => {
      const response = await request(app)
        .post(`/api/subscriptions/${subscriberId}`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('cannot subscribe to your own channel');
    });

    test('10. nonexistent target users return 404', async () => {
      User.findById.mockReturnValue(chain(null));

      const response = await request(app)
        .post(`/api/subscriptions/${creatorId}`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Creator not found');
    });

    test('11. database or server failures return appropriate error responses', async () => {
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1', role: 'creator' }));
      Subscription.findOneAndUpdate.mockRejectedValue(new Error('Database disk error'));

      const response = await request(app)
        .post(`/api/subscriptions/${creatorId}`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(500);
    });

    test('12. fetches subscription status accurately', async () => {
      Subscription.countDocuments
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(42);

      const response = await request(app)
        .get(`/api/subscriptions/status/${creatorId}`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(200);
      expect(response.body.data.isSubscribed).toBe(true);
      expect(response.body.data.subscriberCount).toBe(42);
    });
  });

  describe('User Profile Route (GET /api/users/:id)', () => {
    test('fetches public creator profile with valid ID', async () => {
      User.findById.mockReturnValue(chain({
        _id: creatorId,
        username: 'videomaker',
        fullName: 'Video Maker',
        avatar: 'https://example.com/avatar.jpg',
        bio: 'Hello world',
        role: 'creator',
        createdAt: new Date().toISOString(),
      }));

      const response = await request(app).get(`/api/users/${creatorId}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user.username).toBe('videomaker');
      expect(response.body.data.user.fullName).toBe('Video Maker');
    });

    test('rejects invalid ObjectId with 400', async () => {
      const response = await request(app).get('/api/users/not-a-valid-id');
      expect(response.status).toBe(400);
    });

    test('returns 404 when user is not found', async () => {
      User.findById.mockReturnValue(chain(null));
      const response = await request(app).get(`/api/users/${creatorId}`);
      expect(response.status).toBe(404);
    });
  });

  describe('Video Interactions', () => {
    test('increments video view count with public/unlisted approved filter', async () => {
      Video.findOneAndUpdate.mockReturnValue(
        chain({ _id: videoId, views: 10 })
      );

      const response = await request(app)
        .post(`/api/videos/${videoId}/view`);

      expect(response.status).toBe(200);
      expect(response.body.data.views).toBe(10);
      expect(Video.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: videoId,
          moderationStatus: 'approved',
        }),
        { $inc: { views: 1 } },
        { new: true }
      );
    });

    test('likes a video', async () => {
      Video.findById.mockReturnValue(chain({ _id: videoId }));
      VideoInteraction.findOneAndUpdate.mockResolvedValue({});
      VideoInteraction.countDocuments.mockResolvedValue(6);

      const response = await request(app)
        .post(`/api/videos/${videoId}/like`)
        .set('Authorization', 'Bearer user-token')
        .send({ action: 'like' });

      expect(response.status).toBe(200);
      expect(response.body.data.liked).toBe(true);
      expect(response.body.data.likeCount).toBe(6);
    });

    test('toggles watch later status', async () => {
      VideoInteraction.findOneAndUpdate.mockResolvedValue({});

      const response = await request(app)
        .post(`/api/videos/${videoId}/watch-later`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(200);
      expect(response.body.data.watchLater).toBe(true);
    });
  });

  describe('Comments', () => {
    test('creates a comment on a video', async () => {
      Comment.create.mockResolvedValue({ _id: 'c1' });
      Comment.findById.mockReturnValue(chain({
        _id: 'c1',
        text: 'Awesome video!',
        user: { _id: '507f1f77bcf86cd799439011', username: 'testuser' },
        video: videoId,
      }));

      const response = await request(app)
        .post(`/api/videos/${videoId}/comments`)
        .set('Authorization', 'Bearer user-token')
        .send({ text: 'Awesome video!' });

      expect(response.status).toBe(201);
      expect(response.body.data.text).toBe('Awesome video!');
    });

    test('lists comments for a video', async () => {
      Comment.find.mockReturnValue(chain([
        { _id: 'c1', text: 'Great content', user: { username: 'john' } },
      ]));

      const response = await request(app)
        .get(`/api/videos/${videoId}/comments`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].text).toBe('Great content');
    });

    test('deletes own comment via /api/videos/:id/comments/:commentId', async () => {
      const commentId = '507f1f77bcf86cd799439099';
      Comment.findOneAndDelete.mockResolvedValue({ _id: commentId });

      const response = await request(app)
        .delete(`/api/videos/${videoId}/comments/${commentId}`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(200);
      expect(Comment.findOneAndDelete).toHaveBeenCalledWith({
        _id: commentId,
        user: subscriberId,
        video: videoId,
      });
    });

    test('rejects non-string comment payload with 400 instead of 500', async () => {
      const response = await request(app)
        .post(`/api/videos/${videoId}/comments`)
        .set('Authorization', 'Bearer user-token')
        .send({ text: 12345 });

      expect(response.status).toBe(400);
    });
  });

  describe('Priority 1 Integration Fixes', () => {
    test('updates subscription notification bell preference', async () => {
      Subscription.findOneAndUpdate.mockReturnValue(
        chain({ subscriber: subscriberId, creator: creatorId, notificationLevel: 'none' })
      );

      const response = await request(app)
        .patch(`/api/subscriptions/${creatorId}/notifications`)
        .set('Authorization', 'Bearer user-token')
        .send({ notificationLevel: 'none' });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ creatorId, notificationLevel: 'none' });
    });

    test('persists user preferences via GET/PATCH /api/users/me/preferences', async () => {
      User.findById.mockReturnValue(chain({ preferences: { autoplay: false, historyPaused: true } }));
      const getRes = await request(app)
        .get('/api/users/me/preferences')
        .set('Authorization', 'Bearer user-token');
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.autoplay).toBe(false);
      expect(getRes.body.data.historyPaused).toBe(true);

      User.findByIdAndUpdate.mockReturnValue(
        chain({ preferences: { autoplay: true, historyPaused: true } })
      );
      const patchRes = await request(app)
        .patch('/api/users/me/preferences')
        .set('Authorization', 'Bearer user-token')
        .send({ autoplay: true });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.autoplay).toBe(true);
    });

    test('rejects invalid creator query param on GET /api/videos with 400', async () => {
      const response = await request(app).get('/api/videos?creator=not-an-id');
      expect(response.status).toBe(400);
    });

    test('submits content report via top-level POST /api/reports', async () => {
      Report.create.mockResolvedValue({
        _id: '507f1f77bcf86cd799439088',
        targetType: 'video',
        targetId: videoId,
        reason: 'spam',
        status: 'pending',
        createdAt: new Date().toISOString(),
      });

      const response = await request(app)
        .post('/api/reports')
        .set('Authorization', 'Bearer user-token')
        .send({ targetType: 'video', targetId: videoId, reason: 'spam' });

      expect(response.status).toBe(201);
      expect(response.body.data.reason).toBe('spam');
    });
  });
});
