const request = require('supertest');
const mongoose = require('mongoose');

jest.mock('../../models/user.model', () => ({
  findById: jest.fn(),
}));

jest.mock('../../models/review.model', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
}));

jest.mock('../../middleware/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    if (req.headers.authorization === 'Bearer user-token') {
      req.user = { id: '507f1f77bcf86cd799439011', username: 'testreviewer' };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Authentication required' });
  },
  optionalAuthenticate: (req, _res, next) => {
    if (req.headers.authorization === 'Bearer user-token') {
      req.user = { id: '507f1f77bcf86cd799439011', username: 'testreviewer' };
    }
    next();
  },
  requireAdmin: (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ success: false }),
  requireCreator: (req, res, next) => req.user?.role === 'creator' ? next() : res.status(403).json({ success: false }),
}));

const User = require('../../models/user.model');
const Review = require('../../models/review.model');
const app = require('../../app');

const chain = (result) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});

describe('Creator Reviews API', () => {
  const reviewerId = '507f1f77bcf86cd799439011';
  const creatorId = '507f191e810c19729de860ea';
  const reviewId = '507f1f77bcf86cd799439099';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users/:id/reviews', () => {
    test('fetches creator reviews and calculates average rating', async () => {
      const mockReviews = [
        {
          _id: 'r1',
          rating: 5,
          comment: 'Great creator!',
          reviewer: { _id: 'u1', username: 'user1' },
        },
        {
          _id: 'r2',
          rating: 4,
          comment: 'Very helpful videos',
          reviewer: { _id: reviewerId, username: 'testreviewer' },
        },
      ];
      Review.find.mockReturnValue(chain(mockReviews));

      const response = await request(app)
        .get(`/api/users/${creatorId}/reviews`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(200);
      expect(response.body.data.totalReviews).toBe(2);
      expect(response.body.data.averageRating).toBe(4.5);
      expect(response.body.data.userReview).toBeDefined();
      expect(response.body.data.userReview._id).toBe('r2');
    });

    test('rejects invalid creator ID with 400', async () => {
      const response = await request(app).get('/api/users/not-an-id/reviews');
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid creator ID');
    });
  });

  describe('POST /api/users/:id/reviews', () => {
    test('submits a review for a creator successfully', async () => {
      User.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: creatorId, role: 'creator' }),
        }),
      });

      const savedReview = {
        _id: reviewId,
        creator: creatorId,
        reviewer: { _id: reviewerId, username: 'testreviewer' },
        rating: 5,
        comment: 'Outstanding channel content!',
      };

      Review.findOneAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(savedReview),
      });

      Review.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ rating: 5 }]),
      });

      const response = await request(app)
        .post(`/api/users/${creatorId}/reviews`)
        .set('Authorization', 'Bearer user-token')
        .send({ rating: 5, comment: 'Outstanding channel content!' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.averageRating).toBe(5);
      expect(response.body.data.totalReviews).toBe(1);
    });

    test('prevents self-reviewing with 400', async () => {
      const response = await request(app)
        .post(`/api/users/${reviewerId}/reviews`)
        .set('Authorization', 'Bearer user-token')
        .send({ rating: 5 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('cannot review yourself');
    });

    test('rejects invalid rating numbers with 400', async () => {
      const response = await request(app)
        .post(`/api/users/${creatorId}/reviews`)
        .set('Authorization', 'Bearer user-token')
        .send({ rating: 6 });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Rating must be a number between 1 and 5');
    });

    test('rejects unauthenticated review submission with 401', async () => {
      const response = await request(app)
        .post(`/api/users/${creatorId}/reviews`)
        .send({ rating: 5 });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/users/:id/reviews/:reviewId', () => {
    test('deletes user review successfully', async () => {
      Review.findOneAndDelete.mockResolvedValue({ _id: reviewId });
      Review.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const response = await request(app)
        .delete(`/api/users/${creatorId}/reviews/${reviewId}`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(200);
      expect(response.body.data.totalReviews).toBe(0);
      expect(Review.findOneAndDelete).toHaveBeenCalledWith({
        _id: reviewId,
        creator: creatorId,
        reviewer: reviewerId,
      });
    });

    test('returns 404 when review is not found or not owned', async () => {
      Review.findOneAndDelete.mockResolvedValue(null);

      const response = await request(app)
        .delete(`/api/users/${creatorId}/reviews/${reviewId}`)
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(404);
    });
  });
});
