const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../../models/notification.model', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
  deleteOne: jest.fn(),
  updateOne: jest.fn(),
  insertMany: jest.fn(),
}));

jest.mock('../../models/user.model', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../../models/video.model', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../../models/subscription.model', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock('../../models/comment.model', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  find: jest.fn(),
  deleteOne: jest.fn(),
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (authHeader === 'Bearer expired-token') {
      return res.status(401).json({ success: false, message: 'Your session expired. Please sign in again.' });
    }
    const tokenMap = {
      'Bearer user-a': { id: '507f1f77bcf86cd799439011', username: 'alice' },
      'Bearer user-b': { id: '507f1f77bcf86cd799439022', username: 'bob' },
      'Bearer user-c': { id: '507f1f77bcf86cd799439033', username: 'charlie' },
    };
    const user = tokenMap[authHeader];
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    return next();
  },
  optionalAuthenticate: (req, _res, next) => {
    if (req.headers.authorization === 'Bearer user-a') {
      req.user = { id: '507f1f77bcf86cd799439011', username: 'alice' };
    }
    next();
  },
}));

const Notification = require('../../models/notification.model');
const User = require('../../models/user.model');
const Video = require('../../models/video.model');
const Subscription = require('../../models/subscription.model');
const Comment = require('../../models/comment.model');
const app = require('../../app');

const userA = '507f1f77bcf86cd799439011';
const userB = '507f1f77bcf86cd799439022';
const userC = '507f1f77bcf86cd799439033';
const notifIdA = '507f1f77bcf86cd7994390aa';
const notifIdB = '507f1f77bcf86cd7994390bb';
const videoId = '507f1f77bcf86cd7994390cc';

const chain = (result) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

describe('Sprint 5: Final Reliability Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Cross-User Privacy and Ownership Isolation', () => {
    test('User A cannot fetch User B\'s notifications', async () => {
      Notification.find.mockReturnValue(chain([]));
      Notification.countDocuments.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer user-a');

      expect(res.status).toBe(200);
      expect(Notification.find).toHaveBeenCalledWith({ recipient: userA });
      expect(Notification.find).not.toHaveBeenCalledWith(expect.objectContaining({ recipient: userB }));
    });

    test('User A cannot mark User B\'s notification as read (returns 404)', async () => {
      Notification.findOneAndUpdate.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      const res = await request(app)
        .patch(`/api/notifications/${notifIdB}/read`)
        .set('Authorization', 'Bearer user-a');

      expect(res.status).toBe(404);
      expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: notifIdB, recipient: userA },
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('User A cannot delete User B\'s notification (returns 404)', async () => {
      Notification.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const res = await request(app)
        .delete(`/api/notifications/${notifIdB}`)
        .set('Authorization', 'Bearer user-a');

      expect(res.status).toBe(404);
      expect(Notification.deleteOne).toHaveBeenCalledWith({ _id: notifIdB, recipient: userA });
    });

    test('Mark all as read only updates the calling user\'s unread items', async () => {
      Notification.updateMany.mockResolvedValue({ modifiedCount: 3 });

      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', 'Bearer user-a');

      expect(res.status).toBe(200);
      expect(Notification.updateMany).toHaveBeenCalledWith(
        { recipient: userA, isRead: false },
        { $set: { isRead: true, readAt: expect.any(Date) } }
      );
    });
  });

  describe('2. Authentication Safeguards & Expired Sessions', () => {
    test('rejects expired access token with 401', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer expired-token');

      expect(res.status).toBe(401);
      expect(res.body.message).toContain('expired');
      expect(Notification.find).not.toHaveBeenCalled();
    });

    test('rejects unauthenticated requests to unread-count', async () => {
      const res = await request(app).get('/api/notifications/unread-count');
      expect(res.status).toBe(401);
    });
  });

  describe('3. Pagination Boundaries & Query Validation', () => {
    test('handles empty notification lists cleanly', async () => {
      Notification.find.mockReturnValue(chain([]));
      Notification.countDocuments.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/notifications?page=1&limit=20')
        .set('Authorization', 'Bearer user-a');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasMore: false,
      });
    });

    test('caps oversized limit to 50', async () => {
      const findChainMock = chain([]);
      Notification.find.mockReturnValue(findChainMock);
      Notification.countDocuments.mockResolvedValue(0);

      await request(app)
        .get('/api/notifications?limit=250')
        .set('Authorization', 'Bearer user-a');

      expect(findChainMock.limit).toHaveBeenCalledWith(50);
    });

    test('rejects negative or invalid page parameters with 400', async () => {
      const res = await request(app)
        .get('/api/notifications?page=-5')
        .set('Authorization', 'Bearer user-a');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid page');
    });

    test('rejects malformed ObjectId parameters with 400', async () => {
      const res = await request(app)
        .patch('/api/notifications/invalid-id/read')
        .set('Authorization', 'Bearer user-a');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid notification ID');
    });
  });

  describe('4. Multi-User Event Generation Flow', () => {
    test('User A subscribing to Creator B notifies Creator B', async () => {
      User.findById
        .mockReturnValueOnce(chain({ _id: userB, username: 'bob', fullName: 'Bob Builder' }))
        .mockReturnValueOnce(chain({ _id: userA, username: 'alice', fullName: 'Alice' }));
      Subscription.findOneAndUpdate.mockResolvedValue({});
      Subscription.countDocuments.mockResolvedValue(1);
      Notification.updateOne.mockResolvedValue({ upsertedCount: 1 });

      const res = await request(app)
        .post(`/api/subscriptions/${userB}`)
        .set('Authorization', 'Bearer user-a');

      expect(res.status).toBe(200);
      expect(Notification.updateOne).toHaveBeenCalledWith(
        { recipient: userB, dedupeKey: `subscriber:${userA}` },
        { $setOnInsert: expect.objectContaining({ recipient: userB, actor: userA, type: 'new_subscriber' }) },
        { upsert: true }
      );
    });

    test('User C commenting on Creator B\'s video notifies Creator B', async () => {
      Comment.create.mockResolvedValue({ _id: 'comm1' });
      Comment.findById.mockReturnValue(chain({
        _id: 'comm1',
        text: 'Awesome tutorial!',
        user: { _id: userC, username: 'charlie' },
        video: videoId,
      }));
      Video.findById.mockReturnValue(chain({ _id: videoId, creator: userB, title: 'Node Tutorial' }));
      User.findById.mockReturnValue(chain({ _id: userC, username: 'charlie', fullName: 'Charlie' }));
      Notification.updateOne.mockResolvedValue({ upsertedCount: 1 });

      const res = await request(app)
        .post(`/api/videos/${videoId}/comments`)
        .set('Authorization', 'Bearer user-c')
        .send({ text: 'Awesome tutorial!' });

      expect(res.status).toBe(201);
      expect(Notification.updateOne).toHaveBeenCalledWith(
        { recipient: userB, dedupeKey: 'comment:comm1' },
        { $setOnInsert: expect.objectContaining({ recipient: userB, actor: userC, type: 'new_comment' }) },
        { upsert: true }
      );
    });

    test('Creator commenting on their own video generates no self-notification', async () => {
      Comment.create.mockResolvedValue({ _id: 'comm2' });
      Comment.findById.mockReturnValue(chain({
        _id: 'comm2',
        text: 'My own reply',
        user: { _id: userB, username: 'bob' },
        video: videoId,
      }));
      Video.findById.mockReturnValue(chain({ _id: videoId, creator: userB, title: 'Node Tutorial' }));

      const res = await request(app)
        .post(`/api/videos/${videoId}/comments`)
        .set('Authorization', 'Bearer user-b')
        .send({ text: 'My own reply' });

      expect(res.status).toBe(201);
      expect(Notification.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('5. Core Action Resilience on Notification Failure', () => {
    test('Subscription succeeds even if notification database call errors', async () => {
      User.findById.mockReturnValue(chain({ _id: userB, username: 'bob', fullName: 'Bob' }));
      Subscription.findOneAndUpdate.mockResolvedValue({});
      Subscription.countDocuments.mockResolvedValue(5);
      Notification.updateOne.mockRejectedValue(new Error('Notification connection timeout'));

      const res = await request(app)
        .post(`/api/subscriptions/${userB}`)
        .set('Authorization', 'Bearer user-a');

      expect(res.status).toBe(200);
      expect(res.body.data.subscribed).toBe(true);
      expect(res.body.data.subscriberCount).toBe(5);
    });

    test('Comment creation succeeds even if video lookup for notification fails', async () => {
      Comment.create.mockResolvedValue({ _id: 'comm3' });
      Comment.findById.mockReturnValue(chain({
        _id: 'comm3',
        text: 'Great work',
        user: { _id: userA, username: 'alice' },
        video: videoId,
      }));
      Video.findById.mockImplementation(() => { throw new Error('Video lookup failed'); });

      const res = await request(app)
        .post(`/api/videos/${videoId}/comments`)
        .set('Authorization', 'Bearer user-a')
        .send({ text: 'Great work' });

      expect(res.status).toBe(201);
      expect(res.body.data.text).toBe('Great work');
    });
  });
});
