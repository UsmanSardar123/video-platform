jest.mock('../../services/notificationEvents.service', () => ({
  notifyNewVideo: jest.fn().mockResolvedValue(undefined),
  notifyNewComment: jest.fn(),
  notifyNewSubscriber: jest.fn(),
}));
jest.mock('../../services/cloudinary.service', () => ({
  verifyUploadedAsset: jest.fn(),
  deleteVideoAssets: jest.fn(),
}));
jest.mock('../../models/video.model', () => ({ findOne: jest.fn(), create: jest.fn() }));

const Video = require('../../models/video.model');
const { verifyUploadedAsset } = require('../../services/cloudinary.service');
const { notifyNewVideo } = require('../../services/notificationEvents.service');
const { completeUpload } = require('../../services/video.service');
const { createExternalVideo } = require('../../services/externalVideo.service');

const userId = '507f1f77bcf86cd799439011';

describe('new-video notification triggers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notifyNewVideo.mockResolvedValue(undefined);
  });

  describe('device upload (completeUpload)', () => {
    const metadata = { publicId: 'p', format: 'mp4', title: 'T', description: '', category: 'Other', visibility: 'public' };
    const asset = { public_id: 'p', secure_url: 'https://res.cloudinary.com/x/video/upload/p.mp4', duration: 3 };

    test('notifies only after the video is persisted', async () => {
      verifyUploadedAsset.mockResolvedValue(asset);
      Video.findOne.mockResolvedValue(null);
      const saved = { _id: 'v1', creator: userId, visibility: 'public' };
      Video.create.mockResolvedValue(saved);
      const result = await completeUpload(userId, metadata);
      expect(result).toBe(saved);
      expect(notifyNewVideo).toHaveBeenCalledTimes(1);
      expect(notifyNewVideo).toHaveBeenCalledWith(saved);
      expect(Video.create.mock.invocationCallOrder[0]).toBeLessThan(notifyNewVideo.mock.invocationCallOrder[0]);
    });

    test('a retried completion for an existing video does not notify again', async () => {
      verifyUploadedAsset.mockResolvedValue(asset);
      Video.findOne.mockResolvedValue({ _id: 'v1', creator: { toString: () => userId } });
      await completeUpload(userId, metadata);
      expect(notifyNewVideo).not.toHaveBeenCalled();
    });

    test('does not notify when persistence fails', async () => {
      verifyUploadedAsset.mockResolvedValue(asset);
      Video.findOne.mockResolvedValue(null);
      Video.create.mockRejectedValue(new Error('db error'));
      await expect(completeUpload(userId, metadata)).rejects.toThrow('db error');
      expect(notifyNewVideo).not.toHaveBeenCalled();
    });

    test('does not notify when Cloudinary verification fails', async () => {
      verifyUploadedAsset.mockRejectedValue(new Error('not found'));
      await expect(completeUpload(userId, metadata)).rejects.toThrow('not found');
      expect(notifyNewVideo).not.toHaveBeenCalled();
    });

    test('the upload succeeds even if the notifier rejects unexpectedly', async () => {
      verifyUploadedAsset.mockResolvedValue(asset);
      Video.findOne.mockResolvedValue(null);
      Video.create.mockResolvedValue({ _id: 'v1' });
      notifyNewVideo.mockImplementation(() => Promise.resolve());
      await expect(completeUpload(userId, metadata)).resolves.toEqual({ _id: 'v1' });
    });
  });

  describe('external link (createExternalVideo)', () => {
    const input = { url: 'https://youtu.be/abcdefghijk', title: 'Link', description: '', category: 'Other', visibility: 'public' };

    test('notifies after a new link video is stored', async () => {
      Video.findOne.mockResolvedValue(null);
      const saved = { _id: 'v2', creator: userId, visibility: 'public' };
      Video.create.mockResolvedValue(saved);
      await expect(createExternalVideo(userId, input)).resolves.toBe(saved);
      expect(notifyNewVideo).toHaveBeenCalledWith(saved);
    });

    test('a duplicate link returns the existing video without notifying', async () => {
      Video.findOne.mockResolvedValue({ _id: 'v2' });
      await createExternalVideo(userId, input);
      expect(notifyNewVideo).not.toHaveBeenCalled();
    });

    test('does not notify when the URL is rejected', async () => {
      await expect(createExternalVideo(userId, { ...input, url: 'https://example.com/x.mp4' })).rejects.toMatchObject({ statusCode: 400 });
      expect(notifyNewVideo).not.toHaveBeenCalled();
    });

    test('does not notify when persistence fails', async () => {
      Video.findOne.mockResolvedValue(null);
      Video.create.mockRejectedValue(new Error('db error'));
      await expect(createExternalVideo(userId, input)).rejects.toThrow('db error');
      expect(notifyNewVideo).not.toHaveBeenCalled();
    });
  });
});
