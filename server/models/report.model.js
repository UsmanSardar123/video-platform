const mongoose = require('mongoose');

const REPORT_TARGET_TYPES = ['video', 'user', 'comment'];
const REPORT_REASONS = [
  'inappropriate_content',
  'harassment',
  'copyright',
  'spam',
  'misinformation',
  'violence',
  'other',
];
const REPORT_STATUSES = ['pending', 'investigating', 'resolved', 'dismissed'];

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: REPORT_TARGET_TYPES,
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: REPORT_REASONS,
      required: true,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    status: {
      type: String,
      enum: REPORT_STATUSES,
      default: 'pending',
      index: true,
    },
    resolutionNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });

const Report =
  mongoose.models.Report || mongoose.model('Report', reportSchema);

module.exports = Report;
module.exports.REPORT_TARGET_TYPES = REPORT_TARGET_TYPES;
module.exports.REPORT_REASONS = REPORT_REASONS;
module.exports.REPORT_STATUSES = REPORT_STATUSES;
