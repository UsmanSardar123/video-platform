const subscriptionService = require('../services/subscription.service');

const handleSubscribe = async (req, res, next) => {
  try {
    const result = await subscriptionService.subscribe(req.user.id, req.params.creatorId);
    res.status(200).json({ success: true, message: 'Subscribed successfully', data: result });
  } catch (error) { next(error); }
};

const handleUnsubscribe = async (req, res, next) => {
  try {
    const result = await subscriptionService.unsubscribe(req.user.id, req.params.creatorId);
    res.status(200).json({ success: true, message: 'Unsubscribed successfully', data: result });
  } catch (error) { next(error); }
};

const handleGetSubscriptions = async (req, res, next) => {
  try {
    const creators = await subscriptionService.getSubscriptions(req.user.id);
    res.status(200).json({ success: true, data: creators });
  } catch (error) { next(error); }
};

const handleGetSubscriptionsFeed = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const result = await subscriptionService.getSubscriptionsFeed(req.user.id, { page, limit });
    res.status(200).json({ success: true, data: result.videos, pagination: result });
  } catch (error) { next(error); }
};

const handleGetSubscriptionStatus = async (req, res, next) => {
  try {
    const isSubscribed = await subscriptionService.isSubscribed(req.user?.id, req.params.creatorId);
    const subscriberCount = await subscriptionService.getSubscriberCount(req.params.creatorId);
    res.status(200).json({
      success: true,
      data: { isSubscribed, subscriberCount },
    });
  } catch (error) { next(error); }
};

module.exports = {
  handleSubscribe,
  handleUnsubscribe,
  handleGetSubscriptions,
  handleGetSubscriptionsFeed,
  handleGetSubscriptionStatus,
};
