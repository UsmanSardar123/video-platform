jest.mock('../../models/video.model', () => ({ findOne: jest.fn(), findById: jest.fn(), exists: jest.fn() }));
jest.mock('../../models/videoInteraction.model', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateMany: jest.fn(),
  updateOne: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock('../../models/comment.model', () => ({ findOneAndDelete: jest.fn() }));
jest.mock('../../services/notificationEvents.service', () => ({ notifyNewComment: jest.fn() }));

const VideoInteraction = require('../../models/videoInteraction.model');
const Video = require('../../models/video.model');
const Comment = require('../../models/comment.model');
const service = require('../../services/interaction.service');

const chain = (value) => ({
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(value),
});

describe('private interaction ownership', () => {
  beforeEach(() => jest.clearAllMocks());

  test('watch later and history queries are always scoped to the authenticated owner', async () => {
    VideoInteraction.find.mockReturnValue(chain([]));
    const userA = '507f1f77bcf86cd799439011';
    const userB = '507f1f77bcf86cd799439022';

    await service.getWatchLaterVideos(userA);
    expect(VideoInteraction.find).toHaveBeenLastCalledWith({ user: userA, watchLater: true });
    await service.getHistory(userB);
    expect(VideoInteraction.find).toHaveBeenLastCalledWith({ user: userB, watchedAt: { $ne: null } });
  });

  test('clear and remove history mutations include the owner in their Mongo filters', async () => {
    const userA = '507f1f77bcf86cd799439011';
    const userB = '507f1f77bcf86cd799439022';
    VideoInteraction.updateMany.mockResolvedValue({ modifiedCount: 0 });
    VideoInteraction.updateOne.mockResolvedValue({ modifiedCount: 0 });

    await service.clearHistory(userA);
    expect(VideoInteraction.updateMany).toHaveBeenCalledWith(
      { user: userA }, { $set: { watchedAt: null } }
    );
    await service.removeHistoryItem(userB, '507f1f77bcf86cd799439033');
    expect(VideoInteraction.updateOne).toHaveBeenCalledWith(
      { user: userB, video: '507f1f77bcf86cd799439033' }, { $set: { watchedAt: null } }
    );
  });

  test('comment deletion combines the comment ID with the authenticated owner', async () => {
    const commentId = '507f1f77bcf86cd799439033';
    const ownerB = '507f1f77bcf86cd799439022';
    Comment.findOneAndDelete.mockResolvedValue(null);
    await expect(service.deleteComment(ownerB, commentId)).rejects.toMatchObject({ statusCode: 404 });
    expect(Comment.findOneAndDelete).toHaveBeenCalledWith({ _id: commentId, user: ownerB });
  });

  test('a guessed private video ID cannot expose interaction data or accept a comment', async () => {
    const userA = '507f1f77bcf86cd799439011';
    const videoOwnedByB = '507f1f77bcf86cd799439033';
    Video.exists.mockResolvedValue(false);

    await expect(service.getVideoInteraction(userA, videoOwnedByB)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.addComment(userA, videoOwnedByB, 'attempt')).rejects.toMatchObject({ statusCode: 404 });
    expect(VideoInteraction.findOne).not.toHaveBeenCalled();
    expect(Comment.findOneAndDelete).not.toHaveBeenCalled();
  });
});
