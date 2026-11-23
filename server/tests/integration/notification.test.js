const request = require('supertest');

jest.mock('../../models/notification.model', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
  deleteOne: jest.fn(),
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    const users = {
      'Bearer user-a': { id: '507f1f77bcf86cd799439011', username: 'usera' },
      'Bearer user-b': { id: '507f1f77bcf86cd799439022', username: 'userb' },
    };
    const user = users[req.headers.authorization];
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });
    req.user = user;
    return next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
  requireAdmin: (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ success: false }),
  requireCreator: (req, res, next) => req.user?.role === 'creator' ? next() : res.status(403).json({ success: false }),
}));

const Notification = require('../../models/notification.model');
const app = require('../../app');

const userA = '507f1f77bcf86cd799439011';
const userB = '507f1f77bcf86cd799439022';
const notifId = '507f1f77bcf86cd7994390aa';

const findChain = (result) => {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
  return chain;
};
const leanResult = (result) => ({ lean: jest.fn().mockResolvedValue(result) });

describe('Notification API', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('authentication', () => {
    test.each([
      ['get', '/api/notifications'],
      ['get', '/api/notifications/unread-count'],
      ['patch', '/api/notifications/read-all'],
      ['patch', `/api/notifications/${notifId}/read`],
      ['delete', `/api/notifications/${notifId}`],
    ])('%s %s rejects unauthenticated requests', async (method, url) => {
      const res = await request(app)[method](url);
      expect(res.status).toBe(401);
      expect(Notification.find).not.toHaveBeenCalled();
    });

    test('rejects an invalid token', async () => {
      const res = await request(app).get('/api/notifications').set('Authorization', 'Bearer bad');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/notifications (pagination and ownership)', () => {
    test('returns only the caller\'s notifications with default pagination', async () => {
      const chain = findChain([{ _id: notifId, message: 'hi', isRead: false }]);
      Notification.find.mockReturnValue(chain);
      Notification.countDocuments.mockResolvedValue(1);

      const res = await request(app).get('/api/notifications').set('Authorization', 'Bearer user-a');

      expect(res.status).toBe(200);
      expect(Notification.find).toHaveBeenCalledWith({ recipient: userA });
      expect(chain.skip).toHaveBeenCalledWith(0);
      expect(chain.limit).toHaveBeenCalledWith(20);
      expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false });
    });

    test('a different user is scoped to their own recipient id', async () => {
      Notification.find.mockReturnValue(findChain([]));
      Notification.countDocuments.mockResolvedValue(0);
      await request(app).get('/api/notifications').set('Authorization', 'Bearer user-b');
      expect(Notification.find).toHaveBeenCalledWith({ recipient: userB });
    });

    test('computes skip, hasMore and totalPages for page 2', async () => {
      const chain = findChain([]);
      Notification.find.mockReturnValue(chain);
      Notification.countDocuments.mockResolvedValue(45);

      const res = await request(app)
        .get('/api/notifications?page=2&limit=10')
        .set('Authorization', 'Bearer user-a');

      expect(chain.skip).toHaveBeenCalledWith(10);
      expect(chain.limit).toHaveBeenCalledWith(10);
      expect(res.body.pagination).toMatchObject({ page: 2, limit: 10, total: 45, totalPages: 5, hasMore: true });
    });

    test('last page reports hasMore=false and an empty list is valid', async () => {
      Notification.find.mockReturnValue(findChain([]));
      Notification.countDocuments.mockResolvedValue(20);
      const res = await request(app)
        .get('/api/notifications?page=2&limit=10')
        .set('Authorization', 'Bearer user-a');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.hasMore).toBe(false);
    });

    test('caps limit at 50', async () => {
      const chain = findChain([]);
      Notification.find.mockReturnValue(chain);
      Notification.countDocuments.mockResolvedValue(0);
      await request(app).get('/api/notifications?limit=500').set('Authorization', 'Bearer user-a');
      expect(chain.limit).toHaveBeenCalledWith(50);
    });

    test('supports unread-only filter', async () => {
      Notification.find.mockReturnValue(findChain([]));
      Notification.countDocuments.mockResolvedValue(0);
      await request(app).get('/api/notifications?unread=true').set('Authorization', 'Bearer user-a');
      expect(Notification.find).toHaveBeenCalledWith({ recipient: userA, isRead: false });
    });

    test.each(['page=0', 'page=abc', 'page=-1', 'limit=0', 'limit=x', 'unread=maybe'])(
      'rejects invalid query %s with 400',
      async (qs) => {
        const res = await request(app).get(`/api/notifications?${qs}`).set('Authorization', 'Bearer user-a');
        expect(res.status).toBe(400);
        expect(Notification.find).not.toHaveBeenCalled();
      }
    );
  });

  describe('GET /api/notifications/unread-count', () => {
    test('counts only the caller\'s unread notifications', async () => {
      Notification.countDocuments.mockResolvedValue(7);
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', 'Bearer user-a');
      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(7);
      expect(Notification.countDocuments).toHaveBeenCalledWith({ recipient: userA, isRead: false });
    });

    test('returns zero when there are none', async () => {
      Notification.countDocuments.mockResolvedValue(0);
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', 'Bearer user-b');
      expect(res.body.data.unreadCount).toBe(0);
      expect(Notification.countDocuments).toHaveBeenCalledWith({ recipient: userB, isRead: false });
    });
  });

  describe('PATCH /api/notifications/:id/read', () => {
    test('marks an owned notification as read and returns the new unread count', async () => {
      Notification.findOneAndUpdate.mockReturnValue(leanResult({ _id: notifId, isRead: true }));
      Notification.countDocuments.mockResolvedValue(2);

      const res = await request(app)
        .patch(`/api/notifications/${notifId}/read`)
        .set('Authorization', 'Bearer user-a');

      expect(res.status).toBe(200);
      expect(res.body.data.notification.isRead).toBe(true);
      expect(res.body.data.unreadCount).toBe(2);
      const [filter, update] = Notification.findOneAndUpdate.mock.calls[0];
      expect(filter).toEqual({ _id: notifId, recipient: userA });
      expect(update.$set.isRead).toBe(true);
      expect(update.$set.readAt).toBeInstanceOf(Date);
    });

    test('another user\'s notification returns 404 (not found for caller)', async () => {
      Notification.findOneAndUpdate.mockReturnValue(leanResult(null));
      const res = await request(app)
        .patch(`/api/notifications/${notifId}/read`)
        .set('Authorization', 'Bearer user-b');
      expect(res.status).toBe(404);
      expect(Notification.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: notifId, recipient: userB });
    });

    test('is idempotent when already read', async () => {
      Notification.findOneAndUpdate.mockReturnValue(leanResult({ _id: notifId, isRead: true }));
      Notification.countDocuments.mockResolvedValue(0);
      const first = await request(app).patch(`/api/notifications/${notifId}/read`).set('Authorization', 'Bearer user-a');
      const second = await request(app).patch(`/api/notifications/${notifId}/read`).set('Authorization', 'Bearer user-a');
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
    });

    test('rejects a malformed id with 400', async () => {
      const res = await request(app)
        .patch('/api/notifications/not-an-id/read')
        .set('Authorization', 'Bearer user-a');
      expect(res.status).toBe(400);
      expect(Notification.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/notifications/read-all', () => {
    test('marks only the caller\'s unread notifications as read', async () => {
      Notification.updateMany.mockResolvedValue({ modifiedCount: 4 });
      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', 'Bearer user-a');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ modifiedCount: 4, unreadCount: 0 });
      const [filter, update] = Notification.updateMany.mock.calls[0];
      expect(filter).toEqual({ recipient: userA, isRead: false });
      expect(update.$set.isRead).toBe(true);
    });

    test('succeeds with zero modifications when nothing is unread', async () => {
      Notification.updateMany.mockResolvedValue({ modifiedCount: 0 });
      const res = await request(app).patch('/api/notifications/read-all').set('Authorization', 'Bearer user-b');
      expect(res.status).toBe(200);
      expect(res.body.data.modifiedCount).toBe(0);
      expect(Notification.updateMany.mock.calls[0][0]).toEqual({ recipient: userB, isRead: false });
    });
  });

  describe('DELETE /api/notifications/:id', () => {
    test('deletes an owned notification', async () => {
      Notification.deleteOne.mockResolvedValue({ deletedCount: 1 });
      Notification.countDocuments.mockResolvedValue(3);
      const res = await request(app).delete(`/api/notifications/${notifId}`).set('Authorization', 'Bearer user-a');
      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(3);
      expect(Notification.deleteOne).toHaveBeenCalledWith({ _id: notifId, recipient: userA });
    });

    test('cannot delete another user\'s notification (404)', async () => {
      Notification.deleteOne.mockResolvedValue({ deletedCount: 0 });
      const res = await request(app).delete(`/api/notifications/${notifId}`).set('Authorization', 'Bearer user-b');
      expect(res.status).toBe(404);
      expect(Notification.deleteOne).toHaveBeenCalledWith({ _id: notifId, recipient: userB });
    });

    test('rejects a malformed id with 400', async () => {
      const res = await request(app).delete('/api/notifications/xyz').set('Authorization', 'Bearer user-a');
      expect(res.status).toBe(400);
      expect(Notification.deleteOne).not.toHaveBeenCalled();
    });
  });

  test('database failures return 500', async () => {
    Notification.countDocuments.mockRejectedValue(new Error('db down'));
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', 'Bearer user-a');
    expect(res.status).toBe(500);
  });
});
