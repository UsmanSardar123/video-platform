const mongoose = require('mongoose');
const Video = require('../models/video.model');
const User = require('../models/user.model');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const searchVideos = async ({ q = '', sourceType, creator = '', page = 1, limit = 20 }) => {
  const filter = { visibility: 'public' };
  if (sourceType) filter.sourceType = sourceType;
  if (creator) {
    const creatorRegex = new RegExp(`^${escapeRegex(creator)}$`, 'i');
    const users = await User.find({ $or: [{ username: creatorRegex }, { fullName: creatorRegex }] })
      .select('_id').limit(50).lean();
    const ids = users.map((user) => user._id);
    if (mongoose.Types.ObjectId.isValid(creator)) ids.push(new mongoose.Types.ObjectId(creator));
    if (!ids.length) return { videos: [], total: 0, page, limit, totalPages: 0 };
    filter.creator = { $in: ids };
  }
  if (q) {
    const matchingUsers = await User.find({ $or: [
      { username: new RegExp(escapeRegex(q), 'i') },
      { fullName: new RegExp(escapeRegex(q), 'i') },
    ] }).select('_id').limit(100).lean();
    const clauses = [{ $text: { $search: q } }];
    if (matchingUsers.length) clauses.push({ creator: { $in: matchingUsers.map((user) => user._id) } });
    filter.$or = clauses;
  }

  const [videos, total] = await Promise.all([
    Video.find(filter).populate('creator', 'username fullName avatar')
      .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Video.countDocuments(filter),
  ]);
  return { videos, total, page, limit, totalPages: Math.ceil(total / limit) };
};

module.exports = { searchVideos, escapeRegex };
