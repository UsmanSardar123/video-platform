const mongoose = require('mongoose');

const adminAuditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    target: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action: {
      type: String,
      enum: [
        'user.role.changed',
        'admin.videos.read',
        'admin.reports.read',
        'video.approved',
        'video.rejected',
        'video.visibility.changed',
        'video.deleted',
        'report.updated',
      ],
      required: true,
    },
    resourceType: { type: String, enum: ['user', 'video', 'report'], default: 'user' },
    resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    details: {
      from: { type: String, enum: ['user', 'creator', 'admin'] },
      to: { type: String, enum: ['user', 'creator', 'admin'] },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminAuditLogSchema.index({ target: 1, createdAt: -1 });
adminAuditLogSchema.index({ actor: 1, createdAt: -1 });
adminAuditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

module.exports = mongoose.models.AdminAuditLog || mongoose.model('AdminAuditLog', adminAuditLogSchema);
