const express = require('express');
const mongoose = require('mongoose');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');
const authService = require('../services/auth.service');
const { deleteVideoAssets } = require('../services/cloudinary.service');
const User = require('../models/user.model');
const Video = require('../models/video.model');
const Subscription = require('../models/subscription.model');
const Comment = require('../models/comment.model');
const VideoInteraction = require('../models/videoInteraction.model');
const Report = require('../models/report.model');

const router = express.Router();

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * POST /api/admin/auth/login
 * Dedicated admin login verifying email, password, and admin role on the server.
 */
router.post('/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const result = await authService.login({ email, password });

    if (result.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Administrator privileges required.',
        userRole: result.user.role,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Admin authenticated successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/auth/me
 * Verifies current admin session
 */
router.get('/auth/me', authenticate, requireAdmin, async (req, res) => {
  res.status(200).json({
    success: true,
    data: { admin: req.user },
  });
});

/**
 * GET /api/admin/stats
 * Aggregates live platform metrics from MongoDB Atlas
 */
router.get('/stats', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalVideos,
      viewsAgg,
      totalSubs,
      totalComments,
      pendingModeration,
      pendingReports,
      recentUsers,
      recentVideos,
    ] = await Promise.all([
      User.countDocuments(),
      Video.countDocuments(),
      Video.aggregate([{ $group: { _id: null, totalViews: { $sum: '$views' } } }]),
      Subscription.countDocuments().catch(() => 0),
      Comment.countDocuments().catch(() => 0),
      Video.countDocuments({ moderationStatus: 'pending' }).catch(() => 0),
      Report.countDocuments({ status: 'pending' }).catch(() => 0),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('username email fullName avatar role createdAt isActive')
        .lean(),
      Video.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('creator', 'username fullName avatar')
        .lean(),
    ]);

    const totalViews = viewsAgg && viewsAgg.length > 0 ? viewsAgg[0].totalViews : 0;

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalVideos,
        totalViews,
        totalSubscriptions: totalSubs,
        totalComments,
        pendingModeration,
        pendingReports,
        hasReportSystem: true,
        recentUsers,
        recentVideos,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/users
 * Real paginated users list with search and filtering
 */
router.get('/users', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const search = (req.query.search || '').trim();
    const role = (req.query.role || '').trim();

    const filter = {};

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ username: searchRegex }, { email: searchRegex }, { fullName: searchRegex }];
    }

    if (role && role !== 'all') {
      filter.role = role;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('username email fullName avatar bio role createdAt isActive')
        .lean(),
      User.countDocuments(filter),
    ]);

    // Attach video counts per user
    const usersWithCounts = await Promise.all(
      users.map(async (u) => {
        const videoCount = await Video.countDocuments({ creator: u._id });
        return {
          ...u,
          id: u._id.toString(),
          videosCount: videoCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: usersWithCounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/videos
 * Real paginated video catalog for admin with moderation status, category, and search filters
 */
router.get('/videos', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const search = (req.query.search || '').trim();
    const category = (req.query.category || '').trim();
    const visibility = (req.query.visibility || '').trim();
    const moderationStatus = (req.query.moderationStatus || '').trim();

    const filter = {};

    if (moderationStatus && moderationStatus !== 'all') {
      filter.moderationStatus = moderationStatus;
    }

    if (visibility && visibility !== 'all') {
      filter.visibility = visibility;
    }

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchingUsers = await User.find({
        $or: [{ username: searchRegex }, { fullName: searchRegex }],
      }).select('_id');
      const creatorIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { creator: { $in: creatorIds } },
      ];
    }

    const [videos, total] = await Promise.all([
      Video.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('creator', 'username fullName avatar email role')
        .populate('moderatedBy', 'username fullName')
        .lean(),
      Video.countDocuments(filter),
    ]);

    const formattedVideos = videos.map((v) => ({
      ...v,
      id: v._id.toString(),
      moderationStatus: v.moderationStatus || 'approved',
      moderationReason: v.moderationReason || '',
    }));

    res.status(200).json({
      success: true,
      data: formattedVideos,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/videos/pending
 * Dedicated queue for videos awaiting moderation review
 */
router.get('/videos/pending', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));

    const filter = { moderationStatus: 'pending' };

    const [videos, total] = await Promise.all([
      Video.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('creator', 'username fullName avatar email role')
        .lean(),
      Video.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: videos.map((v) => ({ ...v, id: v._id.toString() })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/videos/:id
 * Video inspector endpoint
 */
router.get('/videos/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID format' });
    }

    const video = await Video.findById(req.params.id)
      .populate('creator', 'username fullName avatar email role createdAt')
      .populate('moderatedBy', 'username fullName')
      .lean();

    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        ...video,
        id: video._id.toString(),
        moderationStatus: video.moderationStatus || 'approved',
        moderationReason: video.moderationReason || '',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/videos/:id/approve
 * Approves a video and sets visibility to public
 */
router.patch('/videos/:id/approve', authenticate, requireAdmin, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID format' });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    video.moderationStatus = 'approved';
    video.moderationReason = '';
    video.visibility = 'public';
    video.moderatedAt = new Date();
    video.moderatedBy = req.user._id || req.user.id;

    await video.save();

    const populated = await Video.findById(video._id)
      .populate('creator', 'username fullName avatar email')
      .populate('moderatedBy', 'username fullName')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Video approved successfully and restored to public catalog',
      data: { ...populated, id: populated._id.toString() },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/videos/:id/reject
 * Rejects a video with a mandatory explanation
 */
router.patch('/videos/:id/reject', authenticate, requireAdmin, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID format' });
    }

    const { reason } = req.body;
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A valid rejection reason is required (minimum 3 characters)',
      });
    }

    if (reason.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason cannot exceed 500 characters',
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    video.moderationStatus = 'rejected';
    video.visibility = 'private'; // Instantly removes from public mobile feed
    video.moderationReason = reason.trim();
    video.moderatedAt = new Date();
    video.moderatedBy = req.user._id || req.user.id;

    await video.save();

    const populated = await Video.findById(video._id)
      .populate('creator', 'username fullName avatar email')
      .populate('moderatedBy', 'username fullName')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Video rejected and removed from public streaming',
      data: { ...populated, id: populated._id.toString() },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/videos/:id/visibility
 * Toggles or updates video visibility ('public', 'private', 'unlisted')
 */
router.patch('/videos/:id/visibility', authenticate, requireAdmin, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID format' });
    }

    const { visibility } = req.body;
    const allowed = ['public', 'private', 'unlisted'];
    if (!visibility || !allowed.includes(visibility)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid visibility value. Must be one of: ' + allowed.join(', '),
      });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    video.visibility = visibility;
    await video.save();

    const populated = await Video.findById(video._id)
      .populate('creator', 'username fullName avatar email')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Video visibility set to ' + visibility,
      data: { ...populated, id: populated._id.toString() },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/videos/:id
 * Permanently deletes a video and removes Cloudinary assets if present
 */
router.delete('/videos/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid video ID format' });
    }

    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ success: false, message: 'Video not found' });
    }

    let storageRemoved = false;
    let storageWarning = null;

    if (video.cloudinaryPublicId && video.sourceType === 'cloudinary') {
      try {
        await deleteVideoAssets([video.cloudinaryPublicId]);
        storageRemoved = true;
      } catch (storageErr) {
        storageWarning = storageErr.message || 'Cloudinary asset deletion failed';
        console.warn('Admin video deletion storage cleanup warning:', storageWarning);
      }
    }

    await Video.deleteOne({ _id: video._id });

    await Promise.allSettled([
      Comment.deleteMany({ video: video._id }),
      VideoInteraction.deleteMany({ video: video._id }),
    ]);

    res.status(200).json({
      success: true,
      message: storageWarning
        ? 'Video record removed from database with storage warning: ' + storageWarning
        : 'Video and associated storage assets permanently deleted',
      data: {
        deletedId: video._id.toString(),
        title: video.title,
        storageRemoved,
        storageWarning,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Helper to parse and validate date range
 */
function resolveDateRange(query) {
  const { period = '30d', startDate, endDate } = query;
  let start;
  let end = new Date();

  if (startDate || endDate) {
    if (startDate) {
      start = new Date(startDate);
      if (isNaN(start.getTime())) {
        throw new Error('Invalid startDate format. Expected valid ISO 8601 date.');
      }
    } else {
      start = new Date(0);
    }

    if (endDate) {
      end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new Error('Invalid endDate format. Expected valid ISO 8601 date.');
      }
      end.setHours(23, 59, 59, 999);
    }

    if (start > end) {
      throw new Error('startDate cannot be after endDate');
    }

    return { start, end, label: 'custom' };
  }

  end.setHours(23, 59, 59, 999);
  start = new Date();
  start.setHours(0, 0, 0, 0);

  if (period === '7d') {
    start.setDate(start.getDate() - 6);
  } else if (period === '90d') {
    start.setDate(start.getDate() - 89);
  } else if (period === 'all') {
    start = new Date('2020-01-01T00:00:00.000Z');
  } else {
    start.setDate(start.getDate() - 29);
  }

  return { start, end, label: period };
}

/**
 * GET /api/admin/analytics
 * Real historical aggregations with date range filtering and continuous time series
 */
router.get('/analytics', authenticate, requireAdmin, async (req, res, next) => {
  try {
    let dateRange;
    try {
      dateRange = resolveDateRange(req.query);
    } catch (validationErr) {
      return res.status(400).json({
        success: false,
        message: validationErr.message,
      });
    }

    const { start, end, label } = dateRange;

    // 1. Overall database metrics
    const [
      totalUsers,
      totalVideos,
      viewsAgg,
      totalComments,
      totalSubscriptions,
      approvedCount,
      pendingCount,
      rejectedCount,
      privateCount,
      likesCount,
      dislikesCount,
      watchLaterCount,
      categoriesAgg,
      reportsAgg,
    ] = await Promise.all([
      User.countDocuments(),
      Video.countDocuments(),
      Video.aggregate([{ $group: { _id: null, totalViews: { $sum: '$views' } } }]),
      Comment.countDocuments().catch(() => 0),
      Subscription.countDocuments().catch(() => 0),
      Video.countDocuments({ moderationStatus: 'approved' }).catch(() => 0),
      Video.countDocuments({ moderationStatus: 'pending' }).catch(() => 0),
      Video.countDocuments({ moderationStatus: 'rejected' }).catch(() => 0),
      Video.countDocuments({ visibility: 'private' }).catch(() => 0),
      VideoInteraction.countDocuments({ liked: true }).catch(() => 0),
      VideoInteraction.countDocuments({ disliked: true }).catch(() => 0),
      VideoInteraction.countDocuments({ watchLater: true }).catch(() => 0),
      Video.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalViews: { $sum: '$views' },
          },
        },
        { $sort: { count: -1 } },
      ]).catch(() => []),
      Report.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]).catch(() => []),
    ]);

    const totalViews = viewsAgg && viewsAgg.length > 0 ? viewsAgg[0].totalViews : 0;

    // 2. Metrics within selected period
    const [usersInPeriod, videosInPeriod, interactionsInPeriod] = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            newUsers: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch(() => []),
      Video.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            uploads: { $sum: 1 },
            views: { $sum: '$views' },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch(() => []),
      VideoInteraction.aggregate([
        { $match: { updatedAt: { $gte: start, $lte: end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
            views: { $sum: 1 },
            likes: { $sum: { $cond: ['$liked', 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch(() => []),
    ]);

    // Build timeline maps
    const usersMap = new Map(usersInPeriod.map((u) => [u._id, u.newUsers]));
    const videosMap = new Map(videosInPeriod.map((v) => [v._id, v]));
    const interactionsMap = new Map(interactionsInPeriod.map((i) => [i._id, i]));

    // Generate continuous date-series
    const timeSeries = [];
    const curDate = new Date(start);
    if (label === 'all') {
      const allDates = [...usersInPeriod, ...videosInPeriod].map((x) => x._id).sort();
      if (allDates.length > 0) {
        curDate.setTime(new Date(allDates[0]).getTime());
      }
    }

    const nowEnd = new Date(end);
    let dayCount = 0;
    while (curDate <= nowEnd && dayCount < 366) {
      const dateStr = curDate.toISOString().slice(0, 10);
      const vidData = videosMap.get(dateStr) || { uploads: 0, views: 0 };
      const intData = interactionsMap.get(dateStr) || { views: 0, likes: 0 };
      const newUsers = usersMap.get(dateStr) || 0;

      timeSeries.push({
        date: dateStr,
        newUsers,
        uploads: vidData.uploads || 0,
        views: (vidData.views || 0) + (intData.views || 0),
        likes: intData.likes || 0,
      });

      curDate.setDate(curDate.getDate() + 1);
      dayCount++;
    }

    const newUsersInPeriod = usersInPeriod.reduce((sum, u) => sum + u.newUsers, 0);
    const newVideosInPeriod = videosInPeriod.reduce((sum, v) => sum + v.uploads, 0);
    const viewsInPeriod = timeSeries.reduce((sum, t) => sum + t.views, 0);

    const reportStatusMap = Object.fromEntries(reportsAgg.map((r) => [r._id, r.count]));

    res.status(200).json({
      success: true,
      data: {
        filter: {
          period: label,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        summary: {
          totalUsers,
          newUsersInPeriod,
          totalVideos,
          newVideosInPeriod,
          totalViews,
          viewsInPeriod,
          averageViewsPerVideo: totalVideos > 0 ? (totalViews / totalVideos).toFixed(1) : '0.0',
          moderation: {
            approved: approvedCount,
            pending: pendingCount,
            rejected: rejectedCount,
            private: privateCount,
          },
          engagement: {
            totalLikes: likesCount,
            totalDislikes: dislikesCount,
            totalWatchLater: watchLaterCount,
            totalComments,
            totalSubscriptions,
          },
          reports: {
            total: Object.values(reportStatusMap).reduce((a, b) => a + b, 0),
            pending: reportStatusMap.pending || 0,
            investigating: reportStatusMap.investigating || 0,
            resolved: reportStatusMap.resolved || 0,
            dismissed: reportStatusMap.dismissed || 0,
          },
        },
        categories: categoriesAgg.map((c) => ({
          category: c._id || 'Uncategorized',
          count: c.count,
          totalViews: c.totalViews,
        })),
        timeSeries,
        hasDetailedHistoricalAnalytics: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/reports
 * Paginated reports submitted by users or flagged by the platform
 */
router.get('/reports', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const status = (req.query.status || '').trim();
    const targetType = (req.query.targetType || '').trim();

    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }
    if (targetType && targetType !== 'all') {
      filter.targetType = targetType;
    }

    const [reports, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('reporter', 'username fullName avatar email role')
        .populate('resolvedBy', 'username fullName')
        .lean(),
      Report.countDocuments(filter),
    ]);

    const enrichedReports = await Promise.all(
      reports.map(async (r) => {
        let targetDetails = null;
        if (r.targetType === 'video' && isValidObjectId(r.targetId)) {
          const video = await Video.findById(r.targetId)
            .select('title creator thumbnailUrl visibility moderationStatus views')
            .populate('creator', 'username fullName')
            .lean();
          if (video) {
            targetDetails = {
              title: video.title,
              creator: video.creator?.username || 'unknown',
              thumbnailUrl: video.thumbnailUrl,
              visibility: video.visibility,
              moderationStatus: video.moderationStatus,
            };
          }
        } else if (r.targetType === 'user' && isValidObjectId(r.targetId)) {
          const user = await User.findById(r.targetId)
            .select('username fullName email avatar role')
            .lean();
          if (user) {
            targetDetails = {
              username: user.username,
              fullName: user.fullName,
              email: user.email,
            };
          }
        }

        return {
          ...r,
          id: r._id.toString(),
          targetDetails,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: enrichedReports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/reports/:id
 * Retrieve a single report with full target and reporter details
 */
router.get('/reports/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid report ID format' });
    }

    const report = await Report.findById(req.params.id)
      .populate('reporter', 'username fullName avatar email role')
      .populate('resolvedBy', 'username fullName email')
      .lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    let targetDetails = null;
    if (report.targetType === 'video' && isValidObjectId(report.targetId)) {
      targetDetails = await Video.findById(report.targetId)
        .populate('creator', 'username fullName email')
        .lean();
    } else if (report.targetType === 'user' && isValidObjectId(report.targetId)) {
      targetDetails = await User.findById(report.targetId)
        .select('username fullName email avatar role createdAt')
        .lean();
    }

    res.status(200).json({
      success: true,
      data: {
        ...report,
        id: report._id.toString(),
        targetDetails,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/reports/:id
 * Update report status (investigating, resolved, dismissed) with resolution notes
 */
router.patch('/reports/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid report ID format' });
    }

    const { status, resolutionNotes } = req.body;
    const allowed = ['pending', 'investigating', 'resolved', 'dismissed'];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: ' + allowed.join(', '),
      });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    report.status = status;
    if (resolutionNotes !== undefined) {
      report.resolutionNotes = String(resolutionNotes).trim();
    }

    if (status === 'resolved' || status === 'dismissed') {
      report.resolvedAt = new Date();
      report.resolvedBy = req.user._id || req.user.id;
    }

    await report.save();

    const populated = await Report.findById(report._id)
      .populate('reporter', 'username fullName email')
      .populate('resolvedBy', 'username fullName')
      .lean();

    res.status(200).json({
      success: true,
      message: 'Report status updated to ' + status,
      data: { ...populated, id: populated._id.toString() },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/reports
 * Submit a real report into MongoDB Atlas (useful for platform tests and moderation reporting)
 */
router.post('/reports', authenticate, async (req, res, next) => {
  try {
    const { targetType, targetId, reason, details } = req.body;

    const allowedTypes = ['video', 'user', 'comment'];
    const allowedReasons = [
      'inappropriate_content',
      'harassment',
      'copyright',
      'spam',
      'misinformation',
      'violence',
      'other',
    ];

    if (!targetType || !allowedTypes.includes(targetType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid targetType. Must be one of: ' + allowedTypes.join(', '),
      });
    }

    if (!targetId || !isValidObjectId(targetId)) {
      return res.status(400).json({ success: false, message: 'Invalid targetId format' });
    }

    if (!reason || !allowedReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reason. Must be one of: ' + allowedReasons.join(', '),
      });
    }

    const report = await Report.create({
      reporter: req.user._id || req.user.id,
      targetType,
      targetId,
      reason,
      details: details ? String(details).trim().slice(0, 1000) : '',
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: {
        id: report._id.toString(),
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/activity
 * Real activity feed derived from latest Atlas events (videos, users, and reports)
 */
router.get('/activity', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const [latestVideos, latestUsers, latestReports] = await Promise.all([
      Video.find().sort({ createdAt: -1 }).limit(5).populate('creator', 'username fullName').lean(),
      User.find().sort({ createdAt: -1 }).limit(5).select('username fullName createdAt').lean(),
      Report.find().sort({ createdAt: -1 }).limit(5).populate('reporter', 'username fullName').lean(),
    ]);

    const activity = [];

    latestVideos.forEach((v) => {
      const statusLabel =
        v.moderationStatus === 'rejected'
          ? ' [Rejected]'
          : v.moderationStatus === 'pending'
          ? ' [Pending Review]'
          : '';
      activity.push({
        id: 'vid_' + v._id.toString(),
        type: 'video_processed',
        title: 'Video Asset: "' + v.title + '"' + statusLabel,
        description:
          'Uploaded by @' +
          (v.creator?.username || 'unknown') +
          ' (' +
          v.visibility +
          ') with ' +
          v.views +
          ' views.',
        timestamp: v.createdAt,
        severity: v.moderationStatus === 'rejected' ? 'warning' : 'info',
      });
    });

    latestUsers.forEach((u) => {
      activity.push({
        id: 'usr_' + u._id.toString(),
        type: 'user_registered',
        title: 'New User Registered: @' + u.username,
        description: 'Account created with email ' + (u.fullName ? '(' + u.fullName + ')' : ''),
        timestamp: u.createdAt,
        severity: 'success',
      });
    });

    latestReports.forEach((r) => {
      activity.push({
        id: 'rep_' + r._id.toString(),
        type: 'report_filed',
        title: 'Content Flagged: ' + r.reason.replace(/_/g, ' '),
        description:
          'Flagged by @' +
          (r.reporter?.username || 'user') +
          ' (Status: ' +
          r.status +
          ')',
        timestamp: r.createdAt,
        severity: r.status === 'pending' ? 'danger' : 'info',
      });
    });

    activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.status(200).json({
      success: true,
      data: activity.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
