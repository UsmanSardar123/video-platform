const request = require('supertest');
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req, _res, next) => { req.user = { id: '507f1f77bcf86cd799439011' }; next(); },
  optionalAuthenticate: (_req, _res, next) => next(),
}));
jest.mock('../../models/user.model', () => ({ findById: jest.fn() }));
jest.mock('../../services/user.service', () => ({ deleteAccount: jest.fn() }));
const User = require('../../models/user.model');
const { deleteAccount } = require('../../services/user.service');
const app = require('../../app');

describe('current user profile API', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the authenticated user profile', async () => {
    const user = { _id: { toString: () => '507f1f77bcf86cd799439011' }, username: 'creator', email: 'creator@example.com', fullName: 'Creator', avatar: '', bio: '', role: 'user', createdAt: new Date() };
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    const response = await request(app).get('/api/users/me');
    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ username: 'creator', email: 'creator@example.com' });
    expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
  });

  test('updates username and email through the current-user route', async () => {
    const user = {
      _id: { toString: () => '507f1f77bcf86cd799439011' }, username: 'creator', email: 'old@example.com',
      fullName: 'Creator', avatar: '', bio: '', role: 'user', createdAt: new Date(), save: jest.fn().mockResolvedValue(),
    };
    User.findById.mockResolvedValue(user);
    const response = await request(app).patch('/api/users/me').send({ username: 'new_creator', email: 'NEW@example.com' });
    expect(response.status).toBe(200);
    expect(user.username).toBe('new_creator');
    expect(user.email).toBe('new@example.com');
    expect(response.body.data.user.email).toBe('new@example.com');
  });

  test('requires a current password and delegates account cleanup', async () => {
    const response = await request(app).delete('/api/users/me').send({ password: 'current-password' });
    expect(response.status).toBe(200);
    expect(deleteAccount).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'current-password');
  });
});
