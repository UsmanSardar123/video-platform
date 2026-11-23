const express = require('express');
const mongoose = require('mongoose');
const { authenticate, optionalAuthenticate } = require('../middleware/auth.middleware');
const User = require('../models/user.model');
const Review = require('../models/review.model');
const { validate } = require('../middleware/validate.middleware');
const { deleteAccountSchema } = require('../validators/user.validator');
const { deleteAccount, changePassword, changeEmail } = require('../services/user.service');

const router = express.Router();

// GET /api/users/me — Get the current user's profile
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const user = await User.findById(userId).select(
      'username email fullName avatar bio role createdAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          avatar: user.avatar,
          bio: user.bio,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/me — Update the current user's profile
router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?._id || req.user?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const allowedFields = ['username', 'fullName', 'avatar', 'bio'];
    const unknownFields = Object.keys(req.body).filter((field) => !allowedFields.includes(field));
    if (unknownFields.length) {
      return res.status(400).json({ success: false, message: 'Request contains unsupported profile fields' });
    }
    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        if (typeof req.body[field] !== 'string') {
          return res.status(400).json({
            success: false,
            message: `${field} must be a string`,
          });
        }

        updates[field] = req.body[field].trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one field to update',
      });
    }

    if (updates.username !== undefined) {
      if (!updates.username) {
        return res.status(400).json({
          success: false,
          message: 'Username cannot be empty',
        });
      }

      if (!/^[a-z0-9_]{3,30}$/i.test(updates.username)) {
        return res.status(400).json({
          success: false,
          message:
            'Username must be 3–30 characters and contain only letters, numbers, and underscores',
        });
      }

      updates.username = updates.username.toLowerCase();
    }

    if (updates.fullName !== undefined && updates.fullName.length > 80) {
      return res.status(400).json({ success: false, message: 'fullName must be 80 characters or fewer' });
    }
    if (updates.bio !== undefined && updates.bio.length > 300) {
      return res.status(400).json({ success: false, message: 'bio must be 300 characters or fewer' });
    }
    if (updates.avatar !== undefined && updates.avatar && !/^https:\/\//i.test(updates.avatar)) {
      return res.status(400).json({ success: false, message: 'avatar must be an HTTPS URL' });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    for (const [field, value] of Object.entries(updates)) {
      user[field] = value;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          avatar: user.avatar,
          bio: user.bio,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';

      return res.status(409).json({
        success: false,
        message: `${field} is already in use`,
      });
    }

    next(error);
  }
});

router.post('/me/change-password', authenticate, async (req, res, next) => {
  try {
    const result = await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    res.status(200).json({ success: true, ...result });
  } catch (error) { next(error); }
});

router.post('/me/change-email', authenticate, async (req, res, next) => {
  try {
    const user = await changeEmail(req.user.id, req.body.password, req.body.email);
    res.status(200).json({ success: true, message: 'Email updated successfully', data: { user } });
  } catch (error) { next(error); }
});

const DEFAULT_PREFERENCES = {
  autoplay: true,
  startMuted: false,
  dataSaver: false,
  notifySubscriptions: true,
  notifyComments: true,
  notifyNewVideos: true,
  historyPaused: false,
};
const PREFERENCE_KEYS = Object.keys(DEFAULT_PREFERENCES);

// GET /api/users/me/preferences — Fetch persisted user playback, notification, and privacy preferences
router.get('/me/preferences', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('preferences').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const merged = { ...DEFAULT_PREFERENCES, ...(user.preferences || {}) };
    return res.status(200).json({ success: true, data: merged });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/users/me/preferences — Update persisted user preferences
router.patch('/me/preferences', authenticate, async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const keys = Object.keys(body);
    if (!keys.length) {
      return res.status(400).json({ success: false, message: 'Provide at least one preference to update' });
    }
    const updates = {};
    for (const key of keys) {
      if (!PREFERENCE_KEYS.includes(key)) {
        return res.status(400).json({ success: false, message: `Unsupported preference field: ${key}` });
      }
      if (typeof body[key] !== 'boolean') {
        return res.status(400).json({ success: false, message: `${key} must be a boolean` });
      }
      updates[`preferences.${key}`] = body[key];
    }

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    ).select('preferences').lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      data: { ...DEFAULT_PREFERENCES, ...(updated.preferences || {}) },
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/me', authenticate, validate(deleteAccountSchema), async (req, res, next) => {
  try {
    await deleteAccount(req.user.id, req.body.password);
    res.status(200).json({ success: true, message: 'Account and associated videos deleted' });
  } catch (error) { next(error); }
});

// GET /api/users/:id — Get a public user profile
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const user = await User.findById(id).select('username fullName avatar bio role createdAt').lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: {
        user: {
          id: user._id.toString(),
          _id: user._id.toString(),
          username: user.username,
          fullName: user.fullName,
          avatar: user.avatar,
          bio: user.bio,
          role: user.role === 'creator' ? 'creator' : 'user',
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/users/:id/reviews — List reviews for a creator
router.get('/:id/reviews', optionalAuthenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid creator ID' });
    }

    const reviews = await Review.find({ creator: id })
      .populate('reviewer', 'username fullName avatar')
      .sort({ createdAt: -1 })
      .lean();

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    let userReview = null;
    const currentUserId = req.user?.id || req.user?._id;
    if (currentUserId) {
      userReview =
        reviews.find(
          (r) =>
            r.reviewer &&
            (r.reviewer._id?.toString() === currentUserId.toString() ||
              r.reviewer.toString() === currentUserId.toString())
        ) || null;
    }

    return res.status(200).json({
      success: true,
      data: {
        reviews,
        averageRating,
        totalReviews,
        userReview,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/users/:id/reviews — Submit or update a review for a creator
router.post('/:id/reviews', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user?.id || req.user?._id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid creator ID' });
    }

    if (reviewerId.toString() === id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot review yourself' });
    }

    const creator = await User.findById(id).select('role').lean();
    if (!creator || creator.role !== 'creator') {
      return res.status(404).json({ success: false, message: 'Creator not found' });
    }

    const rating = Number(req.body.rating);
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be a number between 1 and 5' });
    }

    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0, 500) : '';

    const review = await Review.findOneAndUpdate(
      { creator: id, reviewer: reviewerId },
      { rating, comment },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('reviewer', 'username fullName avatar');

    const allReviews = await Review.find({ creator: id }).lean();
    const totalReviews = allReviews.length;
    const averageRating =
      totalReviews > 0
        ? Number((allReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    return res.status(200).json({
      success: true,
      message: 'Review submitted successfully',
      data: {
        review,
        averageRating,
        totalReviews,
      },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/:id/reviews/:reviewId — Delete own review
router.delete('/:id/reviews/:reviewId', authenticate, async (req, res, next) => {
  try {
    const { id, reviewId } = req.params;
    const reviewerId = req.user?.id || req.user?._id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid creator ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: 'Invalid review ID' });
    }

    const deleted = await Review.findOneAndDelete({ _id: reviewId, creator: id, reviewer: reviewerId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Review not found or unauthorized' });
    }

    const allReviews = await Review.find({ creator: id }).lean();
    const totalReviews = allReviews.length;
    const averageRating =
      totalReviews > 0
        ? Number((allReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
        : 0;

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
      data: {
        averageRating,
        totalReviews,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
