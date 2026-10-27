const request = require('supertest');
const mongoose = require('mongoose');
jest.mock('../../models/video.model', () => ({ find: jest.fn(), findOne: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req, _res, next) => { req.user = { id: '507f1f77bcf86cd799439011' }; next(); },
  optionalAuthenticate: (req, _res, next) => {
    if (req.headers.authorization === 'Bearer user-token') req.user = { id: '507f1f77bcf86cd799439011' };
    next();
  },
}));
const Video = require('../../models/video.model');
const app = require('../../app');

const chain = (result) => ({
  populate: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(result),
});

describe('public and owner video access', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns only public feed records', async () => {
    const record = { _id: 'video1', visibility: 'public', title: 'Published' };
    Video.find.mockReturnValue(chain([record]));
    Video.countDocuments.mockResolvedValue(1);
    const response = await request(app).get('/api/videos');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([record]);
    expect(Video.find).toHaveBeenCalledWith({ visibility: 'public' });
  });

  test('returns all public feed records when category is All or omitted', async () => {
    const record = { _id: 'video1', visibility: 'public', title: 'All Videos' };
    Video.find.mockReturnValue(chain([record]));
    Video.countDocuments.mockResolvedValue(1);
    const response = await request(app).get('/api/videos?category=All');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([record]);
    expect(Video.find).toHaveBeenCalledWith({ visibility: 'public' });
  });

  test('filters public feed records by category (e.g. Sports)', async () => {
    const record = { _id: 'video2', visibility: 'public', title: 'Sports Highlight', category: 'Sports' };
    Video.find.mockReturnValue(chain([record]));
    Video.countDocuments.mockResolvedValue(1);
    const response = await request(app).get('/api/videos?category=Sports');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([record]);
    expect(Video.find).toHaveBeenCalledWith({
      visibility: 'public',
      category: /^Sports$/i,
    });
  });

  test('filters public feed records by Other category including legacy General and missing categories', async () => {
    const record = { _id: 'video3', visibility: 'public', title: 'Other Video', category: 'Other' };
    Video.find.mockReturnValue(chain([record]));
    Video.countDocuments.mockResolvedValue(1);
    const response = await request(app).get('/api/videos?category=Other');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([record]);
    expect(Video.find).toHaveBeenCalledWith({
      visibility: 'public',
      $or: [
        { category: /^other$/i },
        { category: /^general$/i },
        { category: { $exists: false } },
        { category: null },
        { category: '' },
      ],
    });
  });

  test('does not reveal a private video to a visitor but allows its owner', async () => {
    Video.findOne.mockReturnValueOnce(chain(null));
    const privateRecord = { _id: 'private1', visibility: 'private' };
    Video.findOne.mockReturnValueOnce(chain(privateRecord));
    const visitor = await request(app).get('/api/videos/507f1f77bcf86cd799439012');
    expect(visitor.status).toBe(404);
    expect(Video.findOne.mock.calls[0][0]).toMatchObject({ visibility: 'public' });
    const owner = await request(app).get('/api/videos/507f1f77bcf86cd799439012').set('Authorization', 'Bearer user-token');
    expect(owner.status).toBe(200);
    expect(Video.findOne.mock.calls[1][0].$or[1].creator).toEqual(new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'));
  });
});
