const mongoose = require('mongoose');
const Subscription = require('../models/subscription.model');
const Video = require('../models/video.model');
const User = require('../models/user.model');
const ApiError = require('../utils/apiError.util');
const { notifyNewSubscriber } = require('./notificationEvents.service');

const getSubscriberCount = async (creatorId) => {
  if (!creatorId || !mongoose.Types.ObjectId.isValid(creatorId)) return 0;
  return Subscription.countDocuments({ creator: creatorId });
};

const isSubscribed = async (subscriberId, creatorId) => {
  if (
    !subscriberId ||
    !creatorId ||
    !mongoose.Types.ObjectId.isValid(subscriberId) ||
    !mongoose.Types.ObjectId.isValid(creatorId)
  ) {
    return false;
  }
  const count = await Subscription.countDocuments({
    subscriber: subscriberId,
    creator: creatorId,
  });
  return count > 0;
};

const subscribe = async (subscriberId, creatorId) => {
  if (
    !subscriberId ||
    !creatorId ||
    !mongoose.Types.ObjectId.isValid(subscriberId) ||
    !mongoose.Types.ObjectId.isValid(creatorId)
  ) {
    throw new ApiError(400, 'Invalid user ID.');
  }

  if (subscriberId.toString() === creatorId.toString()) {
    throw new ApiError(400, 'You cannot subscribe to your own channel.');
  }

  const creator = await User.findById(creatorId).lean();
  if (!creator || creator.role !== 'creator') {
    throw new ApiError(404, 'Creator not found.');
  }

  try {
    await Subscription.findOneAndUpdate(
      { subscriber: subscriberId, creator: creatorId },
      { $setOnInsert: { subscriber: subscriberId, creator: creatorId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (err.code !== 11000) {
      throw err;
    }
  }

  // Deduplicated per (creator, subscriber); never throws, so it cannot fail the subscribe.
  await notifyNewSubscriber(subscriberId, creatorId);

  const subscriberCount = await getSubscriberCount(creatorId);
  return { subscribed: true, subscriberCount };
};

const unsubscribe = async (subscriberId, creatorId) => {
  if (
    !subscriberId ||
    !creatorId ||
    !mongoose.Types.ObjectId.isValid(subscriberId) ||
    !mongoose.Types.ObjectId.isValid(creatorId)
  ) {
    throw new ApiError(400, 'Invalid user ID.');
  }

  await Subscription.deleteOne({
    subscriber: subscriberId,
    creator: creatorId,
  });

  const subscriberCount = await getSubscriberCount(creatorId);
  return { subscribed: false, subscriberCount };
};

const ALLOWED_NOTIFICATION_LEVELS = new Set(['all', 'personalized', 'none']);

const updateNotificationPreference = async (subscriberId, creatorId, notificationLevel) => {
  if (
    !subscriberId ||
    !creatorId ||
    !mongoose.Types.ObjectId.isValid(subscriberId) ||
    !mongoose.Types.ObjectId.isValid(creatorId)
  ) {
    throw new ApiError(400, 'Invalid user ID.');
  }

  if (!ALLOWED_NOTIFICATION_LEVELS.has(notificationLevel)) {
    throw new ApiError(400, 'notificationLevel must be all, personalized, or none.');
  }

  const updated = await Subscription.findOneAndUpdate(
    { subscriber: subscriberId, creator: creatorId },
    { $set: { notificationLevel } },
    { new: true }
  ).lean();

  if (!updated) {
    throw new ApiError(404, 'Subscription not found.');
  }

  return {
    creatorId: String(creatorId),
    notificationLevel: updated.notificationLevel || 'all',
  };
};

const getSubscriptions = async (subscriberId) => {
  const subscriptions = await Subscription.find({ subscriber: subscriberId })
    .populate('creator', 'username fullName avatar bio')
    .sort({ createdAt: -1 })
    .lean();

  const validSubs = subscriptions.filter((sub) => sub.creator);
  if (!validSubs.length) return [];

  const creatorIds = validSubs.map((sub) => sub.creator._id);

  // Batch counts via 2 aggregations instead of 2N per-creator count queries.
  let subCountMap = new Map();
  let videoCountMap = new Map();

  if (typeof Subscription.aggregate === 'function' && typeof Video.aggregate === 'function') {
    const [subCounts, videoCounts] = await Promise.all([
      Subscription.aggregate([
        { $match: { creator: { $in: creatorIds } } },
        { $group: { _id: '$creator', count: { $sum: 1 } } },
      ]),
      Video.aggregate([
        { $match: { creator: { $in: creatorIds }, visibility: 'public', moderationStatus: 'approved' } },
        { $group: { _id: '$creator', count: { $sum: 1 } } },
      ]),
    ]);
    subCountMap = new Map((subCounts || []).map((row) => [String(row._id), row.count]));
    videoCountMap = new Map((videoCounts || []).map((row) => [String(row._id), row.count]));
  } else {
    const counts = await Promise.all(
      creatorIds.map(async (id) => ({
        id: String(id),
        subs: await getSubscriberCount(id),
        videos: await Video.countDocuments({ creator: id, visibility: 'public', moderationStatus: 'approved' }),
      }))
    );
    subCountMap = new Map(counts.map((c) => [c.id, c.subs]));
    videoCountMap = new Map(counts.map((c) => [c.id, c.videos]));
  }

  return validSubs.map((sub) => {
    const creator = sub.creator;
    const key = String(creator._id);
    return {
      _id: creator._id,
      username: creator.username,
      fullName: creator.fullName,
      avatar: creator.avatar,
      bio: creator.bio,
      subscriberCount: subCountMap.get(key) || 0,
      videoCount: videoCountMap.get(key) || 0,
      notificationLevel: sub.notificationLevel || 'all',
    };
  });
};

const getSubscriptionsFeed = async (subscriberId, { page = 1, limit = 20 } = {}) => {
  const subscriptions = await Subscription.find({ subscriber: subscriberId }).select('creator').lean();
  const creatorIds = subscriptions.map((s) => s.creator);

  if (!creatorIds.length) {
    return { videos: [], total: 0, page, limit, totalPages: 0 };
  }

  const filter = {
    creator: { $in: creatorIds },
    visibility: 'public',
    moderationStatus: 'approved',
  };

  const [videos, total] = await Promise.all([
    Video.find(filter)
      .populate('creator', 'username fullName avatar')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Video.countDocuments(filter),
  ]);

  return {
    videos,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

module.exports = {
  subscribe,
  unsubscribe,
  updateNotificationPreference,
  getSubscriptions,
  getSubscriptionsFeed,
  getSubscriberCount,
  isSubscribed,
};
