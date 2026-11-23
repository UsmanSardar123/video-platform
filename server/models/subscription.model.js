const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    subscriber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    notificationLevel: {
      type: String,
      enum: ['all', 'personalized', 'none'],
      default: 'all',
    },
  },
  { timestamps: true }
);

subscriptionSchema.index({ subscriber: 1, creator: 1 }, { unique: true });
subscriptionSchema.index({ creator: 1, _id: 1 });

module.exports =
  mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
