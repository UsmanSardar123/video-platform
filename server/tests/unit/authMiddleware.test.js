process.env.JWT_ACCESS_SECRET = 'middleware-test-secret-at-least-32-characters';
jest.mock('../../models/user.model', () => ({ findById: jest.fn() }));
const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');
const { authenticate } = require('../../middleware/auth.middleware');

const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const invoke = (authorization) => {
  const req = { headers: authorization ? { authorization } : {} };
  const res = response();
  const next = jest.fn();
  return { req, res, next, result: authenticate(req, res, next) };
};

describe('bearer authentication middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects missing and expired access tokens', async () => {
    const missing = invoke();
    await missing.result;
    expect(missing.res.status).toHaveBeenCalledWith(401);
    const expiredToken = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, process.env.JWT_ACCESS_SECRET, { expiresIn: -1 });
    const expired = invoke(`Bearer ${expiredToken}`);
    await expired.result;
    expect(expired.res.status).toHaveBeenCalledWith(401);
    expect(expired.res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid or expired access token' }));
  });

  test('derives user identity from the verified active database user', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({
      _id: { toString: () => '507f1f77bcf86cd799439011' }, username: 'creator', email: 'creator@example.com', role: 'user', isActive: true,
    }) });
    const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1m' });
    const authenticated = invoke(`Bearer ${token}`);
    await authenticated.result;
    expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    expect(authenticated.req.user).toMatchObject({ id: '507f1f77bcf86cd799439011', username: 'creator' });
    expect(authenticated.next).toHaveBeenCalled();
  });
});
