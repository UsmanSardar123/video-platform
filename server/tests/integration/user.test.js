const request = require('supertest');
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req, _res, next) => { req.user = { id: '507f1f77bcf86cd799439011' }; next(); },
  optionalAuthenticate: (_req, _res, next) => next(),
  requireAdmin: (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ success: false }),
  requireCreator: (req, res, next) => req.user?.role === 'creator' ? next() : res.status(403).json({ success: false }),
}));
jest.mock('../../models/user.model', () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock('../../services/user.service', () => ({
  deleteAccount: jest.fn(),
  changeEmail: jest.fn(),
  changePassword: jest.fn(),
}));
const User = require('../../models/user.model');
const { deleteAccount, changeEmail, changePassword } = require('../../services/user.service');
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

  test('updates profile fields but rejects an email change without password verification', async () => {
    const user = {
      _id: { toString: () => '507f1f77bcf86cd799439011' }, username: 'creator', email: 'old@example.com',
      fullName: 'Creator', avatar: '', bio: '', role: 'user', createdAt: new Date(), save: jest.fn().mockResolvedValue(),
    };
    User.findById.mockResolvedValue(user);
    const response = await request(app).patch('/api/users/me').send({ username: 'new_creator' });
    expect(response.status).toBe(200);
    expect(user.username).toBe('new_creator');
    expect(user.email).toBe('old@example.com');
    const unverifiedEmailChange = await request(app).patch('/api/users/me').send({ email: 'new@example.com' });
    expect(unverifiedEmailChange.status).toBe(400);
  });

  test('routes password-confirmed email and password changes through account security services', async () => {
    changeEmail.mockResolvedValue({ id: '507f1f77bcf86cd799439011', email: 'new@example.com' });
    changePassword.mockResolvedValue({ message: 'Password changed successfully' });
    const email = await request(app).post('/api/users/me/change-email').send({ password: 'current-password', email: 'new@example.com' });
    expect(email.status).toBe(200);
    expect(email.body.data.user.email).toBe('new@example.com');
    expect(changeEmail).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'current-password', 'new@example.com');
    const password = await request(app).post('/api/users/me/change-password').send({ currentPassword: 'old-password', newPassword: 'new-password-123' });
    expect(password.status).toBe(200);
    expect(changePassword).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'old-password', 'new-password-123');
  });

  test('requires a current password and delegates account cleanup', async () => {
    const response = await request(app).delete('/api/users/me').send({ password: 'current-password' });
    expect(response.status).toBe(200);
    expect(deleteAccount).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'current-password');
  });

  test('reads and updates persisted user preferences with strict validation', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ preferences: { autoplay: false, dataSaver: true } }),
      }),
    });
    const getRes = await request(app).get('/api/users/me/preferences');
    expect(getRes.status).toBe(200);
    expect(getRes.body.data).toMatchObject({
      autoplay: false,
      dataSaver: true,
      startMuted: false,
      historyPaused: false,
    });

    const badField = await request(app).patch('/api/users/me/preferences').send({ unknownFlag: true });
    expect(badField.status).toBe(400);

    const badType = await request(app).patch('/api/users/me/preferences').send({ autoplay: 'yes' });
    expect(badType.status).toBe(400);

    User.findByIdAndUpdate.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ preferences: { autoplay: false, historyPaused: true } }),
      }),
    });
    const patchRes = await request(app)
      .patch('/api/users/me/preferences')
      .send({ autoplay: false, historyPaused: true });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data).toMatchObject({ autoplay: false, historyPaused: true });
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      { $set: { 'preferences.autoplay': false, 'preferences.historyPaused': true } },
      { new: true }
    );
  });
});
