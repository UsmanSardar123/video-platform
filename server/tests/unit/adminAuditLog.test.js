const mongoose = require('mongoose');
const AdminAuditLog = require('../../models/adminAuditLog.model');

describe('admin audit log records', () => {
  test('supports private-resource access records without embedding personal data', async () => {
    const log = new AdminAuditLog({
      actor: new mongoose.Types.ObjectId(),
      action: 'admin.reports.read',
      resourceType: 'report',
      resourceId: new mongoose.Types.ObjectId(),
    });
    await expect(log.validate()).resolves.toBeUndefined();
  });

  test('records a constrained role transition', async () => {
    const log = new AdminAuditLog({
      actor: new mongoose.Types.ObjectId(),
      target: new mongoose.Types.ObjectId(),
      action: 'user.role.changed',
      details: { from: 'user', to: 'creator' },
    });
    await expect(log.validate()).resolves.toBeUndefined();
  });

  test('rejects unsupported audit actions', async () => {
    const log = new AdminAuditLog({
      actor: new mongoose.Types.ObjectId(),
      action: 'admin.private-history.read',
      resourceType: 'user',
    });
    await expect(log.validate()).rejects.toMatchObject({ name: 'ValidationError' });
  });
});
