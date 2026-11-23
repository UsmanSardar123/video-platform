const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../../models/user.model', () => ({ findById: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../models/refreshToken.model', () => ({ updateMany: jest.fn() }));
jest.mock('../../models/adminAuditLog.model', () => ({ create: jest.fn() }));
jest.mock('../../models/video.model');
jest.mock('../../models/videoInteraction.model');
jest.mock('../../models/comment.model');
jest.mock('../../models/videoInteraction.model');
jest.mock('../../models/subscription.model');
jest.mock('../../models/report.model');
jest.mock('../../services/cloudinary.service', () => ({ deleteVideoAssets: jest.fn() }));
jest.mock('../../middleware/auth.middleware', () => {
  const authenticate = (req, res, next) => {
    const users = {
      'Bearer user': { id: '507f1f77bcf86cd799439011', role: 'user' },
      'Bearer creator': { id: '507f1f77bcf86cd799439022', role: 'creator' },
      'Bearer admin': { id: '507f1f77bcf86cd799439033', role: 'admin' },
    };
    const user = users[req.headers.authorization];
    if (!user) return res.status(401).json({ success: false, message: 'Authentication required' });
    req.user = user;
    return next();
  };
  const authorizeRoles = (...roles) => (req, res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : res.status(req.user ? 403 : 401).json({ success: false });
  return {
    authenticate,
    optionalAuthenticate: (req, _res, next) => next(),
    authorizeRoles,
    requireAdmin: authorizeRoles('admin'),
    requireCreator: authorizeRoles('creator'),
  };
});

const User = require('../../models/user.model');
const Video = require('../../models/video.model');
const VideoInteraction = require('../../models/videoInteraction.model');
const RefreshToken = require('../../models/refreshToken.model');
const AdminAuditLog = require('../../models/adminAuditLog.model');
const app = require('../../app');

const targetId = '507f1f77bcf86cd799439044';

describe('RBAC API authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registration rejects client-supplied creator or admin roles', async () => {
    const response = await request(app).post('/api/auth/register').send({
      username: 'role_escalation',
      email: 'role-escalation@example.test',
      password: 'valid-password',
      role: 'creator',
    });
    expect(response.status).toBe(400);
  });

  test('ordinary users cannot reach upload or creator-library routes; creators pass the role gate', async () => {
    const deniedUpload = await request(app)
      .post('/api/uploads/signature')
      .set('Authorization', 'Bearer user');
    expect(deniedUpload.status).toBe(403);

    const deniedLibrary = await request(app)
      .get('/api/videos/mine')
      .set('Authorization', 'Bearer user');
    expect(deniedLibrary.status).toBe(403);

    const deniedAnalytics = await request(app)
      .get('/api/videos/mine/analytics')
      .set('Authorization', 'Bearer user');
    expect(deniedAnalytics.status).toBe(403);

    const creatorInvalidUpload = await request(app)
      .post('/api/uploads/signature')
      .set('Authorization', 'Bearer creator')
      .send({ forbidden: true });
    expect(creatorInvalidUpload.status).toBe(400);
  });

  test('creator analytics only queries that creator\'s videos and never returns user identities', async () => {
    const videos = [
      { _id: new mongoose.Types.ObjectId(targetId), title: 'Own video', views: 7, moderationStatus: 'approved', visibility: 'public' },
    ];
    const query = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(videos),
    };
    Video.find.mockReturnValue(query);
    VideoInteraction.aggregate.mockResolvedValue([{ _id: videos[0]._id, likes: 2, dislikes: 0 }]);

    const response = await request(app)
      .get('/api/videos/mine/analytics')
      .set('Authorization', 'Bearer creator');

    expect(response.status).toBe(200);
    expect(Video.find).toHaveBeenCalledWith({ creator: '507f1f77bcf86cd799439022' });
    expect(response.body.data).toMatchObject({ totalVideos: 1, totalViews: 7, totalLikes: 2 });
    expect(JSON.stringify(response.body)).not.toContain('userId');
  });

  test('only admins may assign roles, and successful role changes are audited and revoke sessions', async () => {
    const denied = await request(app)
      .patch(`/api/admin/users/${targetId}/role`)
      .set('Authorization', 'Bearer user')
      .send({ role: 'admin' });
    expect(denied.status).toBe(403);
    expect(User.findById).not.toHaveBeenCalled();

    const target = {
      _id: new mongoose.Types.ObjectId(targetId),
      role: 'user',
      isActive: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    User.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(target) });
    RefreshToken.updateMany.mockResolvedValue({ modifiedCount: 1 });
    AdminAuditLog.create.mockResolvedValue([]);
    jest.spyOn(mongoose, 'startSession').mockResolvedValue({
      withTransaction: jest.fn((callback) => callback()),
      endSession: jest.fn().mockResolvedValue(undefined),
    });

    const assigned = await request(app)
      .patch(`/api/admin/users/${targetId}/role`)
      .set('Authorization', 'Bearer admin')
      .send({ role: 'creator' });

    expect(assigned.status).toBe(200);
    expect(assigned.body.data).toEqual({ id: targetId, role: 'creator' });
    expect(target.save).toHaveBeenCalledWith({ session: expect.any(Object) });
    expect(RefreshToken.updateMany).toHaveBeenCalled();
    expect(AdminAuditLog.create).toHaveBeenCalledWith(
      [expect.objectContaining({
        actor: '507f1f77bcf86cd799439033',
        target: target._id,
        action: 'user.role.changed',
        details: { from: 'user', to: 'creator' },
      })],
      { session: expect.any(Object) }
    );
  });
});
