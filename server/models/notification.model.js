const mongoose = require('mongoose');

const NOTIFICATION_TYPES = ['new_video', 'new_comment', 'new_subscriber', 'comment_reply'];

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      default: null,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 280,
    },
    // Navigation metadata consumed by the client (e.g. { screen: 'watch', params: { id } }).
    link: {
      screen: { type: String, trim: true, maxlength: 50 },
      params: { type: Map, of: String, default: undefined },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
    // Optional key used in a later sprint to deduplicate retried events.
    dedupeKey: {
      type: String,
      default: undefined,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Paginated list per recipient, newest first.
notificationSchema.index({ recipient: 1, createdAt: -1 });
// Unread counts and mark-all-as-read.
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index(
  { recipient: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } }
);

const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
