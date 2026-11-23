jest.mock('../../models/notification.model', () => ({
  updateOne: jest.fn(),
  insertMany: jest.fn(),
}));
jest.mock('../../models/subscription.model', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock('../../models/user.model', () => ({ findById: jest.fn() }));
jest.mock('../../models/video.model', () => ({ findById: jest.fn(), exists: jest.fn() }));
jest.mock('../../models/videoInteraction.model', () => ({}));
jest.mock('../../models/comment.model', () => ({ create: jest.fn(), findById: jest.fn() }));

const Notification = require('../../models/notification.model');
const Subscription = require('../../models/subscription.model');
const User = require('../../models/user.model');
const Video = require('../../models/video.model');
const Comment = require('../../models/comment.model');
const {
  notifyNewSubscriber,
  notifyNewComment,
  notifyNewVideo,
  BATCH_SIZE,
} = require('../../services/notificationEvents.service');
const subscriptionService = require('../../services/subscription.service');
const interactionService = require('../../services/interaction.service');

const creatorId = '507f191e810c19729de860ea';
const actorId = '507f1f77bcf86cd799439011';
const videoId = '507f1f77bcf86cd799439012';
const commentId = '507f1f77bcf86cd7994390c1';

const chain = (result) => {
  const c = {
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
  return c;
};

const subs = (n, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({
    _id: `sub${offset + i}`,
    subscriber: `user${offset + i}`,
  }));

describe('notification event generation', () => {
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    User.findById.mockReturnValue(chain({ _id: actorId, username: 'alice', fullName: 'Alice A' }));
    Video.exists.mockResolvedValue(true);
    Notification.updateOne.mockResolvedValue({ upsertedCount: 1 });
    Notification.insertMany.mockResolvedValue([]);
  });
  afterEach(() => errorSpy.mockRestore());

  describe('new subscriber', () => {
    test('notifies the creator with actor, link and a dedupe key', async () => {
      await notifyNewSubscriber(actorId, creatorId);
      const [filter, update, options] = Notification.updateOne.mock.calls[0];
      expect(filter).toEqual({ recipient: creatorId, dedupeKey: `subscriber:${actorId}` });
      expect(options).toEqual({ upsert: true });
      expect(update.$setOnInsert).toMatchObject({
        recipient: creatorId,
        type: 'new_subscriber',
        actor: actorId,
        message: 'Alice A subscribed to your channel',
        link: { screen: 'profile', params: { userId: actorId } },
      });
    });

    test('uses an idempotent upsert so retries do not duplicate', async () => {
      await notifyNewSubscriber(actorId, creatorId);
      await notifyNewSubscriber(actorId, creatorId);
      const keys = Notification.updateOne.mock.calls.map(([f]) => `${f.recipient}|${f.dedupeKey}`);
      expect(new Set(keys).size).toBe(1);
    });

    test('never notifies a user about their own action', async () => {
      await notifyNewSubscriber(actorId, actorId);
      expect(Notification.updateOne).not.toHaveBeenCalled();
    });

    test('skips when the actor no longer exists', async () => {
      User.findById.mockReturnValue(chain(null));
      await notifyNewSubscriber(actorId, creatorId);
      expect(Notification.updateOne).not.toHaveBeenCalled();
    });

    test('a database failure is swallowed and logged', async () => {
      Notification.updateOne.mockRejectedValue(new Error('db down'));
      await expect(notifyNewSubscriber(actorId, creatorId)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('new_subscriber failed: db down'));
    });

    test('subscribe still succeeds when notification creation fails', async () => {
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator', role: 'creator' }));
      Subscription.findOneAndUpdate.mockResolvedValue({});
      Subscription.countDocuments.mockResolvedValue(3);
      Notification.updateOne.mockRejectedValue(new Error('db down'));
      await expect(subscriptionService.subscribe(actorId, creatorId))
        .resolves.toEqual({ subscribed: true, subscriberCount: 3 });
    });

    test('subscribe notifies the creator', async () => {
      User.findById.mockReturnValue(chain({ _id: creatorId, username: 'creator', fullName: 'Creator', role: 'creator' }));
      Subscription.findOneAndUpdate.mockResolvedValue({});
      Subscription.countDocuments.mockResolvedValue(1);
      await subscriptionService.subscribe(actorId, creatorId);
      expect(Notification.updateOne.mock.calls[0][0].recipient).toBe(creatorId);
    });

    test('a rejected self-subscription creates no notification', async () => {
      await expect(subscriptionService.subscribe(actorId, actorId)).rejects.toMatchObject({ statusCode: 400 });
      expect(Notification.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('new comment', () => {
    const args = { commentId, videoId, commenterId: actorId, text: 'Great video!' };

    test('notifies the video owner with video/comment references', async () => {
      Video.findById.mockReturnValue(chain({ _id: videoId, creator: creatorId, title: 'My clip' }));
      await notifyNewComment(args);
      const [filter, update] = Notification.updateOne.mock.calls[0];
      expect(filter).toEqual({ recipient: creatorId, dedupeKey: `comment:${commentId}` });
      expect(update.$setOnInsert).toMatchObject({
        type: 'new_comment',
        actor: actorId,
        video: videoId,
        comment: commentId,
        link: { screen: 'watch', params: { id: videoId, commentId } },
      });
      expect(update.$setOnInsert.message).toContain('My clip');
      expect(update.$setOnInsert.message).toContain('Great video!');
    });

    test('does not notify when commenting on your own video', async () => {
      Video.findById.mockReturnValue(chain({ _id: videoId, creator: actorId, title: 'Mine' }));
      await notifyNewComment(args);
      expect(Notification.updateOne).not.toHaveBeenCalled();
    });

    test('skips when the video no longer exists', async () => {
      Video.findById.mockReturnValue(chain(null));
      await notifyNewComment(args);
      expect(Notification.updateOne).not.toHaveBeenCalled();
    });

    test('keeps the message within the 280 character limit', async () => {
      Video.findById.mockReturnValue(chain({ creator: creatorId, title: 't'.repeat(500) }));
      await notifyNewComment({ ...args, text: 'x'.repeat(1000) });
      expect(Notification.updateOne.mock.calls[0][1].$setOnInsert.message.length).toBeLessThanOrEqual(280);
    });

    test('a database failure is swallowed and logged', async () => {
      Video.findById.mockReturnValue(chain({ creator: creatorId, title: 'x' }));
      Notification.updateOne.mockRejectedValue(new Error('boom'));
      await expect(notifyNewComment(args)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('new_comment failed: boom'));
    });

    test('addComment succeeds and notifies the owner', async () => {
      Comment.create.mockResolvedValue({ _id: commentId });
      Comment.findById.mockReturnValue(chain({ _id: commentId, text: 'hi' }));
      Video.findById.mockReturnValue(chain({ creator: creatorId, title: 'x' }));
      const result = await interactionService.addComment(actorId, videoId, 'hi');
      expect(result.text).toBe('hi');
      expect(Notification.updateOne).toHaveBeenCalledTimes(1);
    });

    test('addComment still succeeds when notification lookup fails', async () => {
      Comment.create.mockResolvedValue({ _id: commentId });
      Comment.findById.mockReturnValue(chain({ _id: commentId, text: 'hi' }));
      Video.findById.mockImplementation(() => { throw new Error('lookup failed'); });
      await expect(interactionService.addComment(actorId, videoId, 'hi')).resolves.toMatchObject({ text: 'hi' });
    });

    test('an invalid comment creates no notification', async () => {
      await expect(interactionService.addComment(actorId, videoId, '   ')).rejects.toMatchObject({ statusCode: 400 });
      expect(Notification.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('new video (bulk subscriber notification)', () => {
    const video = { _id: videoId, creator: creatorId, title: 'Brand new', visibility: 'public' };

    test('notifies every subscriber with video link and dedupe key', async () => {
      Subscription.find.mockReturnValue(chain(subs(3)));
      await notifyNewVideo(video);
      expect(Notification.insertMany).toHaveBeenCalledTimes(1);
      const [docs, options] = Notification.insertMany.mock.calls[0];
      expect(options).toEqual({ ordered: false });
      expect(docs).toHaveLength(3);
      expect(docs[0]).toMatchObject({
        recipient: 'user0',
        type: 'new_video',
        actor: creatorId,
        video: videoId,
        link: { screen: 'watch', params: { id: videoId } },
        dedupeKey: `video:${videoId}`,
      });
      expect(docs[0].message).toContain('Alice A uploaded: Brand new');
    });

    test('processes large audiences in bounded batches using a keyset cursor', async () => {
      const calls = [];
      Subscription.find.mockImplementation((filter) => {
        calls.push(filter);
        if (calls.length === 1) return chain(subs(BATCH_SIZE, 0));
        if (calls.length === 2) return chain(subs(BATCH_SIZE, BATCH_SIZE));
        return chain(subs(200, BATCH_SIZE * 2));
      });
      await notifyNewVideo(video);
      expect(Subscription.find).toHaveBeenCalledTimes(3);
      expect(Notification.insertMany).toHaveBeenCalledTimes(3);
      expect(calls[0]).toEqual({ creator: creatorId, notificationLevel: { $ne: 'none' } });
      expect(calls[1]).toEqual({
        creator: creatorId,
        notificationLevel: { $ne: 'none' },
        _id: { $gt: `sub${BATCH_SIZE - 1}` },
      });
      Notification.insertMany.mock.calls.forEach(([docs]) =>
        expect(docs.length).toBeLessThanOrEqual(BATCH_SIZE));
    });

    test('does not notify for non-public videos', async () => {
      await notifyNewVideo({ ...video, visibility: 'private' });
      expect(Subscription.find).not.toHaveBeenCalled();
      expect(Notification.insertMany).not.toHaveBeenCalled();
    });

    test('does not notify for videos pending moderation', async () => {
      await notifyNewVideo({ ...video, moderationStatus: 'pending' });
      expect(Subscription.find).not.toHaveBeenCalled();
      expect(Notification.insertMany).not.toHaveBeenCalled();
    });

    test('does nothing when the creator has no subscribers', async () => {
      Subscription.find.mockReturnValue(chain([]));
      await notifyNewVideo(video);
      expect(Notification.insertMany).not.toHaveBeenCalled();
    });

    test('never notifies the creator about their own upload', async () => {
      Subscription.find.mockReturnValue(chain([{ _id: 's1', subscriber: creatorId }, ...subs(1)]));
      await notifyNewVideo(video);
      const docs = Notification.insertMany.mock.calls[0][0];
      expect(docs.map((d) => d.recipient)).toEqual(['user0']);
    });

    test('duplicate-key errors from retries are ignored silently', async () => {
      Subscription.find.mockReturnValue(chain(subs(2)));
      Notification.insertMany.mockRejectedValue(
        Object.assign(new Error('bulk'), { writeErrors: [{ code: 11000 }, { code: 11000 }] })
      );
      await expect(notifyNewVideo(video)).resolves.toBeUndefined();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    test('a failed batch is logged and later batches are still attempted', async () => {
      let n = 0;
      Subscription.find.mockImplementation(() => {
        n += 1;
        return chain(n === 1 ? subs(BATCH_SIZE, 0) : subs(5, BATCH_SIZE));
      });
      Notification.insertMany
        .mockRejectedValueOnce(new Error('disk full'))
        .mockResolvedValueOnce([]);
      await expect(notifyNewVideo(video)).resolves.toBeUndefined();
      expect(Notification.insertMany).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('disk full'));
    });

    test('a subscriber lookup failure is swallowed and logged', async () => {
      Subscription.find.mockImplementation(() => { throw new Error('query failed'); });
      await expect(notifyNewVideo(video)).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('new_video failed: query failed'));
    });

    test('ignores a missing video', async () => {
      await expect(notifyNewVideo(null)).resolves.toBeUndefined();
      expect(Subscription.find).not.toHaveBeenCalled();
    });
  });
});
