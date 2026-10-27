const notificationService = require('../services/notification.service');
const ApiError = require('../utils/apiError.util');

const parsePositiveInt = (value, name, fallback, max) => {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) throw new ApiError(400, `Invalid ${name}.`);
  const n = Number.parseInt(value, 10);
  if (n < 1) throw new ApiError(400, `Invalid ${name}.`);
  return max ? Math.min(n, max) : n;
};

const handleList = async (req, res, next) => {
  try {
    const page = parsePositiveInt(req.query.page, 'page', 1);
    const limit = parsePositiveInt(req.query.limit, 'limit', 20, 50);
    const { unread } = req.query;
    if (unread !== undefined && !['true', 'false'].includes(unread)) {
      throw new ApiError(400, 'Invalid unread filter.');
    }
    const result = await notificationService.list(req.user.id, {
      page, limit, unreadOnly: unread === 'true',
    });
    const { notifications, ...pagination } = result;
    res.status(200).json({ success: true, data: notifications, pagination });
  } catch (error) { next(error); }
};

const handleUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await notificationService.getUnreadCount(req.user.id);
    res.status(200).json({ success: true, data: { unreadCount } });
  } catch (error) { next(error); }
};

const handleMarkRead = async (req, res, next) => {
  try {
    const notification = await notificationService.markRead(req.user.id, req.params.id);
    const unreadCount = await notificationService.getUnreadCount(req.user.id);
    res.status(200).json({ success: true, data: { notification, unreadCount } });
  } catch (error) { next(error); }
};

const handleMarkAllRead = async (req, res, next) => {
  try {
    const { modifiedCount } = await notificationService.markAllRead(req.user.id);
    res.status(200).json({ success: true, data: { modifiedCount, unreadCount: 0 } });
  } catch (error) { next(error); }
};

const handleDelete = async (req, res, next) => {
  try {
    await notificationService.remove(req.user.id, req.params.id);
    const unreadCount = await notificationService.getUnreadCount(req.user.id);
    res.status(200).json({ success: true, message: 'Notification deleted', data: { unreadCount } });
  } catch (error) { next(error); }
};

module.exports = { handleList, handleUnreadCount, handleMarkRead, handleMarkAllRead, handleDelete };
