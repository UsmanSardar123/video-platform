jest.mock('mongoose', () => ({
  connection: {
    readyState: 1,
    db: { collection: jest.fn() },
  },
}));

jest.mock('../../models/video.model', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

const mongoose = require('mongoose');
const Video = require('../../models/video.model');
const { searchVideos } = require('../../services/search.service');

const makeVideoQuery = (records) => {
  const query = {
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn(),
  };
  query.sort.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.lean.mockResolvedValue(records);
  Video.find.mockReturnValue(query);
  return query;
};

describe('search service query behavior', () => {
  let users;

  beforeEach(() => {
    jest.clearAllMocks();
    mongoose.connection.readyState = 1;
    users = { find: jest.fn() };
    mongoose.connection.db.collection.mockReturnValue(users);
    Video.countDocuments.mockResolvedValue(0);
  });

  test('searches title, description and creator names with escaped case-insensitive keywords', async () => {
    const creatorId = 'creator-id';
    const creator = { _id: creatorId, username: '[News]Channel', fullName: 'Video Maker' };
    users.find
      .mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([creator]) })
      .mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([creator]) });
    const record = { _id: 'video-id', title: '[News] update', creator: creatorId };
    const query = makeVideoQuery([record]);
    Video.countDocuments.mockResolvedValue(1);

    const result = await searchVideos({ query: '[news]', page: 1, limit: 20 });

    const filter = Video.find.mock.calls[0][0];
    expect(filter.visibility).toBe('public');
    expect(filter.moderationStatus).toBe('approved');
    expect(filter.$or[0].title).toEqual(/\[news\]/i);
    expect(filter.$or[1].description).toEqual(/\[news\]/i);
    expect(filter.$or[2].creator.$in).toEqual([creatorId]);
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(result.videos[0].creator).toEqual(creator);
    expect(result).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  test('returns empty results for a keyword with no matching video or creator', async () => {
    users.find
      .mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([]) })
      .mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([]) });
    makeVideoQuery([]);

    const result = await searchVideos({ query: 'no-such-title', page: 3, limit: 20 });

    expect(result).toMatchObject({ videos: [], page: 3, limit: 20, total: 0, totalPages: 0 });
  });

  test('returns page two using the same database filter and correct offset', async () => {
    users.find.mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([]) });
    const query = makeVideoQuery([]);
    Video.countDocuments.mockResolvedValue(21);

    const result = await searchVideos({ page: 2, limit: 20 });

    expect(query.skip).toHaveBeenCalledWith(20);
    expect(result).toMatchObject({ page: 2, limit: 20, total: 21, totalPages: 2 });
  });

  test('returns an empty page beyond the available result set', async () => {
    users.find.mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([]) });
    const query = makeVideoQuery([]);
    Video.countDocuments.mockResolvedValue(1);

    const result = await searchVideos({ page: 9, limit: 20 });

    expect(query.skip).toHaveBeenCalledWith(160);
    expect(result).toMatchObject({ videos: [], page: 9, limit: 20, total: 1, totalPages: 1 });
  });

  test('filters by a case-insensitive creator username or display name', async () => {
    const creator = { _id: 'creator-id', username: 'ChannelOne', fullName: 'Channel One' };
    users.find
      .mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([creator]) })
      .mockReturnValueOnce({ toArray: jest.fn().mockResolvedValue([creator]) });
    makeVideoQuery([]);

    await searchVideos({ creator: 'channel one', page: 1, limit: 20 });

    expect(Video.find.mock.calls[0][0].creator.$in).toEqual([creator._id]);
    expect(users.find.mock.calls[0][0].$or[1].fullName).toEqual(/channel one/i);
  });

  test('fails with 503 before querying when MongoDB is disconnected', async () => {
    mongoose.connection.readyState = 0;

    await expect(searchVideos({})).rejects.toMatchObject({ statusCode: 503 });
    expect(Video.find).not.toHaveBeenCalled();
    expect(users.find).not.toHaveBeenCalled();
  });
});
