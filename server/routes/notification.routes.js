const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  handleList,
  handleUnreadCount,
  handleMarkRead,
  handleMarkAllRead,
  handleDelete,
} = require('../controllers/notification.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', handleList);
router.get('/unread-count', handleUnreadCount);
router.patch('/read-all', handleMarkAllRead);
router.patch('/:id/read', handleMarkRead);
router.delete('/:id', handleDelete);

module.exports = router;
