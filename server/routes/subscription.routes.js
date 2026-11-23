const express = require('express');
const { authenticate, optionalAuthenticate } = require('../middleware/auth.middleware');
const {
  handleSubscribe,
  handleUnsubscribe,
  handleUpdateNotificationPreference,
  handleGetSubscriptions,
  handleGetSubscriptionsFeed,
  handleGetSubscriptionStatus,
} = require('../controllers/subscription.controller');

const router = express.Router();

router.get('/status/:creatorId', optionalAuthenticate, handleGetSubscriptionStatus);

router.use(authenticate);

router.get('/', handleGetSubscriptions);
router.get('/feed', handleGetSubscriptionsFeed);
router.patch('/:creatorId/notifications', handleUpdateNotificationPreference);
router.post('/:creatorId', handleSubscribe);
router.delete('/:creatorId', handleUnsubscribe);

module.exports = router;
