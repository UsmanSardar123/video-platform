const Notification = require('../../models/notification.model');

describe('notification model', () => {
  const valid = () => ({
    recipient: '507f1f77bcf86cd799439011',
    type: 'new_subscriber',
    message: 'Someone subscribed',
  });

  test('accepts a valid notification, defaulting to unread', () => {
    const doc = new Notification(valid());
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.isRead).toBe(false);
    expect(doc.actor).toBeNull();
  });

  test('requires recipient, type and message', () => {
    const err = new Notification({}).validateSync();
    expect(Object.keys(err.errors)).toEqual(expect.arrayContaining(['recipient', 'type', 'message']));
  });

  test('rejects unknown types and oversized messages', () => {
    expect(new Notification({ ...valid(), type: 'bogus' }).validateSync().errors.type).toBeDefined();
    expect(new Notification({ ...valid(), message: 'x'.repeat(281) }).validateSync().errors.message).toBeDefined();
  });

  test('defines indexes for listing, unread counts and dedupe', () => {
    const indexes = Notification.schema.indexes().map(([fields]) => fields);
    expect(indexes).toContainEqual({ recipient: 1, createdAt: -1 });
    expect(indexes).toContainEqual({ recipient: 1, isRead: 1 });
    expect(indexes).toContainEqual({ recipient: 1, dedupeKey: 1 });
  });
});
