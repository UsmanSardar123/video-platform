const request = require('supertest');
jest.mock('../../services/auth.service', () => ({
  register: jest.fn(), login: jest.fn(), refresh: jest.fn(), logout: jest.fn(),
}));
const authService = require('../../services/auth.service');
const app = require('../../app');

describe('authentication API', () => {
  beforeEach(() => jest.clearAllMocks());

  test('validates registration then returns tokens and the safe user', async () => {
    const tokens = { user: { id: 'u1', username: 'creator' }, accessToken: 'access', refreshToken: 'refresh' };
    authService.register.mockResolvedValue(tokens);
    const invalid = await request(app).post('/api/auth/register').send({ username: 'ab', email: 'wrong', password: 'short' });
    expect(invalid.status).toBe(400);
    expect(authService.register).not.toHaveBeenCalled();
    const response = await request(app).post('/api/auth/register').send({ username: 'Creator', email: 'creator@example.com', password: 'secret-password', fullName: 'Creator' });
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual(tokens);
    expect(authService.register).toHaveBeenCalledWith({ username: 'creator', email: 'creator@example.com', password: 'secret-password', fullName: 'Creator' });
  });

  test('returns a useful unauthorized response for invalid credentials', async () => {
    authService.login.mockRejectedValue(Object.assign(new Error('Invalid email or password'), { statusCode: 401 }));
    const response = await request(app).post('/api/auth/login').send({ email: 'creator@example.com', password: 'incorrect' });
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, message: 'Invalid email or password' });
  });

  test('rotates refresh credentials and supports logout', async () => {
    authService.refresh.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    authService.logout.mockResolvedValue(undefined);
    const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken: 'old-refresh' });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).toBe('new-refresh');
    const loggedOut = await request(app).post('/api/auth/logout').send({ refreshToken: 'new-refresh' });
    expect(loggedOut.status).toBe(200);
    expect(authService.logout).toHaveBeenCalledWith('new-refresh');
  });
});
