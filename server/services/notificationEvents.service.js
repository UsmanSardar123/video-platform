const Notification = require('../models/notification.model');
const Subscription = require('../models/subscription.model');
const User = require('../models/user.model');
const Video = require('../models/video.model');

const BATCH_SIZE = 500;
const MAX_BATCHES = 200; // hard upper bound: 100k subscribers notified per video

const truncate = (text, max) => {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

const logFailure = (event, error) => {
  // Never log request payloads or secrets; the message alone is enough to diagnose.
  console.error(`[notifications] ${event} failed: ${error && error.message ? error.message : error}`);
};

const displayName = async (userId) => {
  const user = await User.findById(userId).select('username fullName').lean();
  return user ? (user.fullName || user.username || 'Someone') : null;
};

const isDuplicateKey = (error) => {
  const code = error && (error.code ?? error.err?.code);
  return code === 11000;
};

// Idempotent single insert: a retried event with the same dedupeKey is a no-op.
const createOnce = (doc) =>
  Notification.updateOne(
    { recipient: doc.recipient, dedupeKey: doc.dedupeKey },
    { $setOnInsert: doc },
    { upsert: true }
  );

/**
 * Notifies the creator that `subscriberId` subscribed. Never throws.
 */
const notifyNewSubscriber = async (subscriberId, creatorId) => {
  try {
    if (!subscriberId || !creatorId || String(subscriberId) === String(creatorId)) return;
    const name = await displayName(subscriberId);
    if (!name) return;
    await createOnce({
      recipient: creatorId,
      type: 'new_subscriber',
      actor: subscriberId,
      message: truncate(`${name} subscribed to your channel`, 280),
      link: { screen: 'profile', params: { userId: String(subscriberId) } },
      dedupeKey: `subscriber:${subscriberId}`,
    });
  } catch (error) {
    logFailure('new_subscriber', error);
  }
};

/**
 * Notifies the video owner about a new comment. Never throws.
 */
const notifyNewComment = async ({ commentId, videoId, commenterId, text }) => {
  try {
    const video = await Video.findById(videoId).select('creator title').lean();
    if (!video || !video.creator) return;
    if (String(video.creator) === String(commenterId)) return;
    const name = await displayName(commenterId);
    if (!name) return;
    await createOnce({
      recipient: video.creator,
      type: 'new_comment',
      actor: commenterId,
      video: videoId,
      comment: commentId,
      message: truncate(`${name} commented on "${truncate(video.title, 60)}": ${truncate(text, 100)}`, 280),
      link: { screen: 'watch', params: { id: String(videoId), commentId: String(commentId) } },
      dedupeKey: `comment:${commentId}`,
    });
  } catch (error) {
    logFailure('new_comment', error);
  }
};

/**
 * Notifies all subscribers of a newly published public video, in bounded batches
 * (one subscriber query and one insertMany per batch). Never throws.
 */
const notifyNewVideo = async (video) => {
  try {
    if (!video || video.visibility !== 'public' || !video.creator) return;
    if (video.moderationStatus && video.moderationStatus !== 'approved') return;
    const creatorId = video.creator;
    const name = await displayName(creatorId);
    if (!name) return;

    const message = truncate(`${name} uploaded: ${truncate(video.title, 120)}`, 280);
    let lastId = null;

    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const filter = { creator: creatorId, notificationLevel: { $ne: 'none' } };
      if (lastId) filter._id = { $gt: lastId };
      const subs = await Subscription.find(filter)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .select('subscriber')
        .lean();
      if (!subs.length) break;
      lastId = subs[subs.length - 1]._id;

      const docs = subs
        .filter((s) => s.subscriber && String(s.subscriber) !== String(creatorId))
        .map((s) => ({
          recipient: s.subscriber,
          type: 'new_video',
          actor: creatorId,
          video: video._id,
          message,
          link: { screen: 'watch', params: { id: String(video._id) } },
          dedupeKey: `video:${video._id}`,
        }));

      if (docs.length) {
        try {
          await Notification.insertMany(docs, { ordered: false });
        } catch (error) {
          const writeErrors = error && error.writeErrors;
          const onlyDuplicates = isDuplicateKey(error) ||
            (Array.isArray(writeErrors) && writeErrors.length > 0 && writeErrors.every(isDuplicateKey));
          // Duplicates mean this batch was already delivered (retry); anything else is logged
          // and the remaining batches are still attempted.
          if (!onlyDuplicates) logFailure('new_video batch', error);
        }
      }
      if (subs.length < BATCH_SIZE) break;
    }
  } catch (error) {
    logFailure('new_video', error);
  }
};

module.exports = { notifyNewSubscriber, notifyNewComment, notifyNewVideo, BATCH_SIZE };
