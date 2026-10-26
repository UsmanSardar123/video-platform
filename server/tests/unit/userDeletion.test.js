jest.mock('../../models/user.model', () => ({ findById: jest.fn(), deleteOne: jest.fn() }));
jest.mock('../../models/video.model', () => ({ find: jest.fn(), deleteMany: jest.fn() }));
jest.mock('../../models/refreshToken.model', () => ({ deleteMany: jest.fn() }));
jest.mock('../../services/cloudinary.service', () => ({ deleteVideoAssets: jest.fn() }));

const User = require('../../models/user.model');
const Video = require('../../models/video.model');
const RefreshToken = require('../../models/refreshToken.model');
const { deleteVideoAssets } = require('../../services/cloudinary.service');
const { deleteAccount } = require('../../services/user.service');
const mongoose = require('mongoose');

describe('account deletion', () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  test('checks the current password and removes media, records, tokens and account', async () => {
    const user = { comparePassword: jest.fn().mockResolvedValue(true) };
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    Video.find.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ cloudinaryPublicId: 'asset-1' }]) });
    const session = { withTransaction: jest.fn(async (callback) => callback()), endSession: jest.fn() };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    await deleteAccount('owner-id', 'correct-password');
    expect(deleteVideoAssets).toHaveBeenCalledWith(['asset-1']);
    expect(Video.deleteMany).toHaveBeenCalledWith({ creator: 'owner-id' }, { session });
    expect(RefreshToken.deleteMany).toHaveBeenCalledWith({ user: 'owner-id' }, { session });
    expect(User.deleteOne).toHaveBeenCalledWith({ _id: 'owner-id' }, { session });
    expect(session.endSession).toHaveBeenCalled();
  });

  test('leaves account data intact when the current password is wrong', async () => {
    const user = { comparePassword: jest.fn().mockResolvedValue(false) };
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    await expect(deleteAccount('owner-id', 'wrong-password')).rejects.toMatchObject({ statusCode: 401 });
    expect(Video.find).not.toHaveBeenCalled();
  });

  test('does not remove database records when Cloudinary cleanup fails', async () => {
    const user = { comparePassword: jest.fn().mockResolvedValue(true) };
    User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(user) });
    Video.find.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ cloudinaryPublicId: 'asset-1' }]) });
    deleteVideoAssets.mockRejectedValueOnce(new Error('Storage unavailable'));
    await expect(deleteAccount('owner-id', 'correct-password')).rejects.toThrow('Storage unavailable');
    expect(Video.deleteMany).not.toHaveBeenCalled();
    expect(RefreshToken.deleteMany).not.toHaveBeenCalled();
    expect(User.deleteOne).not.toHaveBeenCalled();
  });
});
