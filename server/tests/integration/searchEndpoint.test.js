jest.mock('../../services/search.service', () => ({
  searchVideos: jest.fn(),
}));

const request = require('supertest');
const searchService = require('../../services/search.service');
const app = require('../../app');

describe('GET /api/search', () => {
  beforeEach(() => searchService.searchVideos.mockReset());

  test('loads the initial page with the Explore defaults', async () => {
    searchService.searchVideos.mockResolvedValue({
      videos: [{ _id: 'video-1', title: 'Actual result' }],
      page: 1, limit: 20, total: 1, totalPages: 1,
    });

    const response = await request(app).get('/api/search?page=1&limit=20');

    expect(response.status).toBe(200);
    expect(searchService.searchVideos).toHaveBeenCalledWith({
      query: '', creator: '', category: '', sourceType: '', page: 1, limit: 20,
    });
    expect(response.body).toMatchObject({
      success: true,
      data: [{ title: 'Actual result' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  test('passes search, creator, and source filters and supports empty results', async () => {
    searchService.searchVideos.mockResolvedValue({
      videos: [], page: 1, limit: 20, total: 0, totalPages: 0,
    });

    const response = await request(app).get(
      '/api/search?q=missing%20clip&creator=No%20Channel&sourceType=youtube'
    );

    expect(response.status).toBe(200);
    expect(searchService.searchVideos).toHaveBeenCalledWith({
      query: 'missing clip', creator: 'No Channel', category: '', sourceType: 'youtube', page: 1, limit: 20,
    });
    expect(response.body).toMatchObject({ success: true, data: [], pagination: { total: 0 } });
  });

  test('preserves literal special characters and subsequent page parameters', async () => {
    searchService.searchVideos.mockResolvedValue({
      videos: [], page: 2, limit: 2, total: 3, totalPages: 2,
    });

    const response = await request(app).get('/api/search?q=%5Bnews%5D&page=2&limit=2');

    expect(response.status).toBe(200);
    expect(searchService.searchVideos).toHaveBeenCalledWith({
      query: '[news]', creator: '', category: '', sourceType: '', page: 2, limit: 2,
    });
    expect(response.body.pagination).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  test.each([
    ['/api/search?page=0', 'page'],
    ['/api/search?page=invalid', 'page'],
    ['/api/search?limit=51', 'limit'],
    ['/api/search?limit=0', 'limit'],
  ])('rejects invalid pagination in %s', async (path, parameter) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain(parameter);
    expect(searchService.searchVideos).not.toHaveBeenCalled();
  });

  test('returns a service unavailable response when the database is disconnected', async () => {
    searchService.searchVideos.mockRejectedValue(
      Object.assign(new Error('Video search is temporarily unavailable because the database is disconnected'), {
        statusCode: 503,
      })
    );

    const response = await request(app).get('/api/search?page=1&limit=20');

    expect(response.status).toBe(503);
    expect(response.body.message).toContain('database is disconnected');
  });
});
