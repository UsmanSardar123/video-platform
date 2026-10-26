const request = require('supertest');
jest.mock('../../models/video.model', () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../models/user.model', () => ({ find: jest.fn() }));
const Video = require('../../models/video.model');
const User = require('../../models/user.model');
const app = require('../../app');

const makeVideoQuery = (videos = []) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(videos),
});

const mockUserLookup = (users = []) => User.find.mockReturnValue({
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(users),
});

describe('public video search API', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET /api/search?page=1&limit=20 is public and returns the expected empty response', async () => {
    Video.find.mockReturnValue(makeVideoQuery());
    Video.countDocuments.mockResolvedValue(0);

    const response = await request(app).get('/api/search?page=1&limit=20');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(Video.find).toHaveBeenCalledWith({ visibility: 'public' });
  });

  test.each(['river title', 'description phrase'])('searches public title/description text for %s', async (term) => {
    const query = makeVideoQuery([{ _id: 'video1', title: term }]);
    mockUserLookup();
    Video.find.mockReturnValue(query);
    Video.countDocuments.mockResolvedValue(1);

    const response = await request(app).get(`/api/search?q=${encodeURIComponent(term)}&page=1&limit=20`);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(Video.find).toHaveBeenCalledWith({
      visibility: 'public', $or: [{ $text: { $search: term } }],
    });
  });

  test('searches for matching creators and filters to the exact creator', async () => {
    const creatorId = '507f1f77bcf86cd799439011';
    const query = makeVideoQuery([{ _id: 'video1' }]);
    mockUserLookup([{ _id: creatorId }]);
    Video.find.mockReturnValue(query);
    Video.countDocuments.mockResolvedValue(1);

    const response = await request(app).get('/api/search?creator=RiverMaker');

    expect(response.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith({ $or: [
      { username: /^RiverMaker$/i }, { fullName: /^RiverMaker$/i },
    ] });
    expect(Video.find).toHaveBeenCalledWith({
      visibility: 'public', creator: { $in: [creatorId] },
    });
  });

  test.each(['cloudinary', 'youtube', 'vimeo', 'twitch'])(
    'filters public results by %s source', async (sourceType) => {
      Video.find.mockReturnValue(makeVideoQuery());
      Video.countDocuments.mockResolvedValue(0);

      const response = await request(app).get(`/api/search?sourceType=${sourceType}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(Video.find).toHaveBeenCalledWith({ visibility: 'public', sourceType });
    }
  );

  test('applies pagination and reports total result pages', async () => {
    const query = makeVideoQuery([{ _id: 'video21' }]);
    Video.find.mockReturnValue(query);
    Video.countDocuments.mockResolvedValue(21);

    const response = await request(app).get('/api/search?page=2&limit=10');

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
  });

  test.each([
    'page=0', 'page=abc', 'limit=51', 'sourceType=other', 'unexpected=true',
  ])('rejects invalid query parameters: %s', async (params) => {
    const response = await request(app).get(`/api/search?${params}`);
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(Video.find).not.toHaveBeenCalled();
  });

  test('keeps private and unlisted videos out of public search results', async () => {
    Video.find.mockReturnValue(makeVideoQuery());
    Video.countDocuments.mockResolvedValue(0);

    const response = await request(app).get('/api/search');

    expect(response.status).toBe(200);
    expect(Video.find).toHaveBeenCalledWith({ visibility: 'public' });
  });

  test('unknown API paths remain 404s instead of being mistaken for empty results', async () => {
    const response = await request(app).get('/api/not-a-route');
    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/Route not found/);
  });
});
