jest.mock('../../models/video.model', () => ({ findById: jest.fn(), deleteOne: jest.fn() }));
jest.mock('../../services/cloudinary.service', () => ({ deleteVideoAssets: jest.fn(), verifyUploadedAsset: jest.fn() }));

const Video = require('../../models/video.model');
const { deleteVideoAssets } = require('../../services/cloudinary.service');
const { deleteVideo } = require('../../services/video.service');

describe('video deletion ownership', () => {
  beforeEach(() => jest.clearAllMocks());

  test('removes owned Cloudinary media before deleting its record', async () => {
    const video = { _id: 'video-id', creator: { toString: () => 'owner-id' }, cloudinaryPublicId: 'asset-id' };
    Video.findById.mockResolvedValue(video);
    Video.deleteOne.mockResolvedValue({ deletedCount: 1 });
    await expect(deleteVideo('owner-id', 'video-id')).resolves.toBeUndefined();
    expect(deleteVideoAssets).toHaveBeenCalledWith(['asset-id']);
    expect(Video.deleteOne).toHaveBeenCalledWith({ _id: 'video-id', creator: 'owner-id' });
  });

  test('does not remove a video owned by another user', async () => {
    Video.findById.mockResolvedValue({ creator: { toString: () => 'other-user' }, cloudinaryPublicId: 'asset-id' });
    await expect(deleteVideo('owner-id', 'video-id')).rejects.toMatchObject({ statusCode: 404 });
    expect(deleteVideoAssets).not.toHaveBeenCalled();
    expect(Video.deleteOne).not.toHaveBeenCalled();
  });
});
