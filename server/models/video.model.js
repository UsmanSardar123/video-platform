const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    videoUrl: { type: String, required: true, trim: true },
    cloudinaryPublicId: { type: String, trim: true, sparse: true, unique: true },
    thumbnailUrl: { type: String, trim: true, default: '' },
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, trim: true, maxlength: 60, default: 'Other', index: true },
    visibility: { type: String, enum: ['public', 'private', 'unlisted'], default: 'private', index: true },
    moderationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    moderationReason: { type: String, default: '' },
    moderatedAt: { type: Date, default: null },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    sourceType: { type: String, enum: ['cloudinary', 'youtube', 'vimeo', 'twitch'], default: 'cloudinary' },
    duration: { type: Number, min: 0, default: 0 },
    views: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

videoSchema.index({ visibility: 1, moderationStatus: 1, createdAt: -1 });
videoSchema.index({ createdAt: -1 });
videoSchema.index({ category: 1, visibility: 1, createdAt: -1 });

module.exports = mongoose.models.Video || mongoose.model('Video', videoSchema);
