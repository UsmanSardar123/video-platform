const bcrypt = require('bcryptjs');
const User = require('../../models/user.model');

describe('user model authentication safeguards', () => {
  test('hashes passwords with bcrypt before save and compares the original value', async () => {
    const user = new User({ username: 'creator', email: 'creator@example.com', password: 'correct-horse-battery' });
    const hashHook = User.schema.s.hooks._pres.get('save').find(({ fn }) => fn.toString().includes('bcrypt.hash'));
    await hashHook.fn.call(user);
    expect(user.password).not.toBe('correct-horse-battery');
    expect(await bcrypt.compare('correct-horse-battery', user.password)).toBe(true);
    expect(await user.comparePassword('wrong-password')).toBe(false);
  });

  test('does not serialize or select password hashes by default', () => {
    const user = new User({ username: 'creator', email: 'creator@example.com', password: 'secret-password' });
    expect(User.schema.path('password').options.select).toBe(false);
    expect(user.toJSON()).not.toHaveProperty('password');
  });
});
