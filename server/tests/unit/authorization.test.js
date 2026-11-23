const { authorizeRoles, requireCreator, requireAdmin } = require('../../middleware/auth.middleware');

const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('role authorization middleware', () => {
  const invoke = (middleware, role) => {
    const req = role ? { user: { id: `${role}-id`, role } } : {};
    const res = response();
    const next = jest.fn();
    middleware(req, res, next);
    return { res, next };
  };

  test('denies missing authentication and an ordinary user from creator operations', () => {
    const missing = invoke(requireCreator);
    expect(missing.res.status).toHaveBeenCalledWith(401);

    const user = invoke(requireCreator, 'user');
    expect(user.res.status).toHaveBeenCalledWith(403);
    expect(user.next).not.toHaveBeenCalled();
  });

  test('allows creators to upload but keeps admin-only features restricted', () => {
    expect(invoke(requireCreator, 'creator').next).toHaveBeenCalled();
    expect(invoke(requireAdmin, 'creator').res.status).toHaveBeenCalledWith(403);
    expect(invoke(requireAdmin, 'admin').next).toHaveBeenCalled();
  });

  test('supports explicit role allowlists without trusting request bodies', () => {
    const check = authorizeRoles('creator', 'admin');
    expect(invoke(check, 'creator').next).toHaveBeenCalled();
    expect(invoke(check, 'user').res.status).toHaveBeenCalledWith(403);
  });
});
