
const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const User = require('../models/user.model');
const { validate } = require('../middleware/validate.middleware');
const { deleteAccountSchema } = require('../validators/user.validator');
const { deleteAccount } = require('../services/user.service');

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
    allowedFields.push('email');
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
    if (updates.email !== undefined) {
      updates.email = updates.email.toLowerCase();
      if (updates.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address' });
      }
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

router.delete('/me', authenticate, validate(deleteAccountSchema), async (req, res, next) => {
  try {
    await deleteAccount(req.user.id, req.body.password);
    res.status(200).json({ success: true, message: 'Account and associated videos deleted' });
  } catch (error) { next(error); }
});

module.exports = router;
