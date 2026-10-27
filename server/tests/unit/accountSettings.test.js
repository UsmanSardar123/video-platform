jest.mock('../../models/user.model', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../../models/refreshToken.model', () => ({
  updateMany: jest.fn(),
}));

const User = require('../../models/user.model');
const RefreshToken = require('../../models/refreshToken.model');
const { changePassword, changeEmail } = require('../../services/user.service');
const { createAvatarUploadAuthorization } = require('../../services/cloudinary.service');

describe('Account Settings Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('changePassword', () => {
    test('successfully changes password and revokes all active refresh tokens', async () => {
      const mockUser = {
        _id: 'user-123',
        password: 'hashed-old-password',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      RefreshToken.updateMany.mockResolvedValue({ modifiedCount: 2 });

      const result = await changePassword('user-123', 'oldPassword123', 'newPassword456');

      expect(mockUser.comparePassword).toHaveBeenCalledWith('oldPassword123');
      expect(mockUser.password).toBe('newPassword456');
      expect(mockUser.save).toHaveBeenCalled();
      expect(RefreshToken.updateMany).toHaveBeenCalledWith(
        { user: 'user-123', revokedAt: null },
        { $set: { revokedAt: expect.any(Date) } }
      );
      expect(result.message).toContain('Password changed successfully');
    });

    test('rejects password change if current password is wrong', async () => {
      const mockUser = {
        _id: 'user-123',
        password: 'hashed-old-password',
        comparePassword: jest.fn().mockResolvedValue(false),
        save: jest.fn(),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        changePassword('user-123', 'wrongCurrentPassword', 'newPassword456')
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Current password is incorrect',
      });

      expect(mockUser.save).not.toHaveBeenCalled();
      expect(RefreshToken.updateMany).not.toHaveBeenCalled();
    });

    test('rejects if new password is identical to current password', async () => {
      const mockUser = {
        _id: 'user-123',
        password: 'samePassword123',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn(),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        changePassword('user-123', 'samePassword123', 'samePassword123')
      ).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(mockUser.save).not.toHaveBeenCalled();
    });
  });

  describe('changeEmail', () => {
    test('successfully updates email when password is confirmed and email is unique', async () => {
      const mockUser = {
        _id: 'user-123',
        username: 'streanuber',
        email: 'old@example.com',
        fullName: 'Streanub User',
        avatar: '',
        bio: '',
        role: 'user',
        createdAt: new Date(),
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      User.findOne.mockResolvedValue(null); // No collision

      const result = await changeEmail('user-123', 'correctPassword', 'new@example.com');

      expect(mockUser.comparePassword).toHaveBeenCalledWith('correctPassword');
      expect(mockUser.email).toBe('new@example.com');
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.email).toBe('new@example.com');
    });

    test('rejects email change when password is wrong', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'old@example.com',
        comparePassword: jest.fn().mockResolvedValue(false),
        save: jest.fn(),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await expect(
        changeEmail('user-123', 'wrongPassword', 'new@example.com')
      ).rejects.toMatchObject({
        statusCode: 401,
      });

      expect(mockUser.save).not.toHaveBeenCalled();
    });

    test('rejects if new email is already taken by another account', async () => {
      const mockUser = {
        _id: 'user-123',
        email: 'current@example.com',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn(),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      User.findOne.mockResolvedValue({ _id: 'other-user', email: 'taken@example.com' });

      await expect(
        changeEmail('user-123', 'correctPassword', 'taken@example.com')
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'Email is already registered',
      });

      expect(mockUser.save).not.toHaveBeenCalled();
    });
  });

  describe('createAvatarUploadAuthorization', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        CLOUDINARY_CLOUD_NAME: 'test-cloud',
        CLOUDINARY_API_KEY: 'test-key',
        CLOUDINARY_API_SECRET: 'test-secret',
      };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test('generates authorized signed payload for avatar image upload', () => {
      const auth = createAvatarUploadAuthorization('user-123');
      expect(auth).toHaveProperty('uploadUrl');
      expect(auth.resourceType).toBe('image');
      expect(auth.publicId).toMatch(/^streanub\/user_user-123\/avatar_/);
      expect(auth.allowedFormats).toEqual(['jpg', 'jpeg', 'png', 'webp']);
      expect(auth).toHaveProperty('signature');
    });
  });
});
