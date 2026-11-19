jest.mock('../../services/cloudinary.service', () => ({
  verifyUploadedAsset: jest.fn(),
}));
jest.mock('../../services/notificationEvents.service', () => ({
  notifyNewVideo: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../models/video.model', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
}));

const Video = require('../../models/video.model');
const { verifyUploadedAsset } = require('../../services/cloudinary.service');
const { completeUpload, getMyVideos } = require('../../services/video.service');

const input = { title: 'Test', description: '', category: 'General', visibility: 'public', publicId: 'streanub/user_u1/clip_123e4567-e89b-12d3-a456-426614174000', format: 'mp4' };
const asset = { public_id: input.publicId, secure_url: 'https://res.cloudinary.com/test/video/upload/a.mp4', resource_type: 'video', format: 'mp4', bytes: 100, duration: 3 };

describe('video upload persistence', () => {
  beforeEach(() => { Video.findOne.mockResolvedValue(null); verifyUploadedAsset.mockResolvedValue(asset); });

  test('persists verified asset metadata with the authenticated owner', async () => {
    const record = { _id: 'video1', ...input };
    Video.create.mockResolvedValue(record);
    await expect(completeUpload('u1', input)).resolves.toBe(record);
    expect(Video.create).toHaveBeenCalledWith(expect.objectContaining({ creator: 'u1', cloudinaryPublicId: asset.public_id, videoUrl: asset.secure_url, duration: 3 }));
  });

  test('does not persist an asset when Cloudinary verification fails', async () => {
    verifyUploadedAsset.mockRejectedValue(new Error('verification failed'));
    await expect(completeUpload('u1', input)).rejects.toThrow('verification failed');
    expect(Video.create).not.toHaveBeenCalled();
  });

  test('returns an existing record on repeated completion', async () => {
    const record = { _id: 'existing', creator: { toString: () => 'u1' } };
    Video.findOne.mockResolvedValue(record);
    await expect(completeUpload('u1', input)).resolves.toBe(record);
    expect(Video.create).not.toHaveBeenCalled();
  });

  test('retrieves records only for the authenticated owner', async () => {
    const records = [{ _id: 'mine', creator: 'u1' }];
    const query = { sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(records) };
    Video.find.mockReturnValue(query);
    await expect(getMyVideos('u1')).resolves.toBe(records);
    expect(Video.find).toHaveBeenCalledWith({ creator: 'u1' });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });
});
