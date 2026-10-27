const mongoose = require('mongoose');

const videoInteractionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
      index: true,
    },
    liked: {
      type: Boolean,
      default: false,
    },
    disliked: {
      type: Boolean,
      default: false,
    },
    watchLater: {
      type: Boolean,
      default: false,
    },
    watchedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

videoInteractionSchema.index({ user: 1, video: 1 }, { unique: true });
videoInteractionSchema.index({ user: 1, watchLater: 1 });
videoInteractionSchema.index({ user: 1, liked: 1 });
videoInteractionSchema.index({ user: 1, watchedAt: -1 });

module.exports =
  mongoose.models.VideoInteraction ||
  mongoose.model('VideoInteraction', videoInteractionSchema);
