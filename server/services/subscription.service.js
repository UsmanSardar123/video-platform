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
  if (!creator) {
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

const getSubscriptions = async (subscriberId) => {
  const subscriptions = await Subscription.find({ subscriber: subscriberId })
    .populate('creator', 'username fullName avatar bio')
    .sort({ createdAt: -1 })
    .lean();

  const creators = await Promise.all(
    subscriptions
      .filter((sub) => sub.creator)
      .map(async (sub) => {
        const creator = sub.creator;
        const [subscriberCount, videoCount] = await Promise.all([
          getSubscriberCount(creator._id),
          Video.countDocuments({ creator: creator._id, visibility: 'public' }),
        ]);
        return {
          _id: creator._id,
          username: creator.username,
          fullName: creator.fullName,
          avatar: creator.avatar,
          bio: creator.bio,
          subscriberCount,
          videoCount,
        };
      })
  );

  return creators;
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
  getSubscriptions,
  getSubscriptionsFeed,
  getSubscriberCount,
  isSubscribed,
};
