jest.mock('../../services/video.service', () => ({
  listPublicVideos: jest.fn(),
}));

const request = require('supertest');
const videoService = require('../../services/video.service');
const app = require('../../app');

describe('GET /api/videos', () => {
  beforeEach(() => videoService.listPublicVideos.mockReset());

  test('accepts page=1 and limit=20 and returns the public feed envelope', async () => {
    videoService.listPublicVideos.mockResolvedValue({
      videos: [{ _id: 'video-1', title: 'Persisted video' }],
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });

    const response = await request(app).get('/api/videos?page=1&limit=20');

    expect(response.status).toBe(200);
    expect(videoService.listPublicVideos).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      category: undefined,
      creator: undefined,
    });
    expect(response.body).toMatchObject({
      success: true,
      data: [{ _id: 'video-1' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  test('returns an empty data array as a successful empty feed', async () => {
    videoService.listPublicVideos.mockResolvedValue({
      videos: [], page: 1, limit: 20, total: 0, totalPages: 0,
    });

    const response = await request(app).get('/api/videos?page=1&limit=20');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });
});
