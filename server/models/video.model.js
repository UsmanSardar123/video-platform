
const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    cloudinaryPublicId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    sourceType: {
      type: String,
      enum: ['cloudinary', 'youtube', 'vimeo', 'twitch'],
      default: 'cloudinary',
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      default: '',
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 60,
      default: 'General',
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'unlisted'],
      default: 'public',
      index: true,
    },
    views: {
      type: Number,
      default: 0,
      min: 0,
    },
    duration: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

videoSchema.index({ createdAt: -1 });
videoSchema.index({ title: 'text', description: 'text' });

module.exports =
  mongoose.models.Video || mongoose.model('Video', videoSchema);
