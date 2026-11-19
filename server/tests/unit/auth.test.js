process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '2d';

jest.mock('../../models/user.model', () => ({ findOne: jest.fn(), create: jest.fn(), findById: jest.fn() }));
jest.mock('../../models/refreshToken.model', () => ({ create: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() }));

const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');
const RefreshToken = require('../../models/refreshToken.model');
const auth = require('../../services/auth.service');

const user = {
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  username: 'creator', email: 'creator@example.com', fullName: 'Creator', avatar: '', bio: '', role: 'user', isActive: true,
  comparePassword: jest.fn(),
};

describe('authentication service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('registers a unique account and issues short-lived access and expiring refresh tokens', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue(user);
    const result = await auth.register({ username: 'creator', email: 'creator@example.com', password: 'secret-password', fullName: 'Creator' });
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ password: 'secret-password' }));
    expect(result.user).toMatchObject({ id: '507f1f77bcf86cd799439011', username: 'creator' });
    expect(result).not.toHaveProperty('user.password');
    expect(jwt.verify(result.accessToken, process.env.JWT_ACCESS_SECRET).sub).toBe(user._id.toString());
    const savedRefresh = RefreshToken.create.mock.calls[0][0];
    expect(savedRefresh.tokenHash).not.toBe(result.refreshToken);
    expect(savedRefresh.expiresAt.getTime()).toBeGreaterThan(Date.now() + 47 * 60 * 60 * 1000);
    expect(savedRefresh.expiresAt.getTime()).toBeLessThan(Date.now() + 49 * 60 * 60 * 1000);
  });

  test('rejects duplicate registration', async () => {
    User.findOne.mockResolvedValue({ email: 'creator@example.com' });
    await expect(auth.register({ username: 'creator', email: 'creator@example.com', password: 'secret-password' }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(User.create).not.toHaveBeenCalled();
  });

  test('logs in a valid user and rejects invalid passwords with the same public error', async () => {
    user.comparePassword.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    await expect(auth.login({ email: user.email, password: 'valid' })).resolves.toHaveProperty('accessToken');
    await expect(auth.login({ email: user.email, password: 'invalid' })).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
  });

  test('rotates a refresh token atomically and rejects reuse', async () => {
    const oldToken = 'opaque-refresh-token';
    const record = { _id: 'token-record', user: user._id, expiresAt: new Date(Date.now() + 100000), revokedAt: null };
    RefreshToken.findOne.mockReturnValue({ select: () => ({ lean: async () => record }) });
    RefreshToken.findOneAndUpdate.mockResolvedValueOnce(record).mockResolvedValueOnce(null);
    User.findById.mockResolvedValue(user);
    await expect(auth.refresh(oldToken)).resolves.toHaveProperty('refreshToken');
    await expect(auth.refresh(oldToken)).rejects.toMatchObject({ statusCode: 401 });
    expect(RefreshToken.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  test('revokes stored refresh-token hashes on logout', async () => {
    await auth.logout('logout-token');
    expect(RefreshToken.updateOne).toHaveBeenCalledWith(expect.objectContaining({ revokedAt: null }), { $set: expect.objectContaining({ revokedAt: expect.any(Date) }) });
  });
});
