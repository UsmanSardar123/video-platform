const mongoose = require('mongoose');
const Notification = require('../models/notification.model');
const ApiError = require('../utils/apiError.util');

const assertValidId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id) || String(new mongoose.Types.ObjectId(id)) !== String(id)) {
    throw new ApiError(400, 'Invalid notification ID.');
  }
};

const list = async (userId, { page, limit, unreadOnly }) => {
  const filter = { recipient: userId };
  if (unreadOnly) filter.isRead = false;

  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', 'username fullName avatar')
      .lean(),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications: items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasMore: page * limit < total,
  };
};

const getUnreadCount = (userId) =>
  Notification.countDocuments({ recipient: userId, isRead: false });

// Ownership is enforced in the query itself: another user's id yields 404.
const markRead = async (userId, notificationId) => {
  assertValidId(notificationId);
  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  ).lean();
  if (!updated) throw new ApiError(404, 'Notification not found.');
  return updated;
};

const markAllRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { modifiedCount: result.modifiedCount || 0 };
};

const remove = async (userId, notificationId) => {
  assertValidId(notificationId);
  const result = await Notification.deleteOne({ _id: notificationId, recipient: userId });
  if (!result.deletedCount) throw new ApiError(404, 'Notification not found.');
};

module.exports = { list, getUnreadCount, markRead, markAllRead, remove };
