const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../../models/user.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../models/video.model', () => ({
  findById: jest.fn(),
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
  deleteOne: jest.fn(),
  countDocuments: jest.fn(),
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
}));

const User = require('../../models/user.model');
const Video = require('../../models/video.model');
const Subscription = require('../../models/subscription.model');
const VideoInteraction = require('../../models/videoInteraction.model');
const Comment = require('../../models/comment.model');
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
  });

  describe('Subscriptions', () => {
    test('1. an authenticated user can subscribe successfully', async () => {
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1' }));
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
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1' }));
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
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1' }));
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
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1' }));
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
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1' }));
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
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator1' }));
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
    test('increments video view count', async () => {
      Video.findByIdAndUpdate.mockReturnValue(
        chain({ _id: videoId, views: 10 })
      );

      const response = await request(app)
        .post(`/api/videos/${videoId}/view`);

      expect(response.status).toBe(200);
      expect(response.body.data.views).toBe(10);
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
  });
});
