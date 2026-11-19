const mongoose = require('mongoose');
const Video = require('../models/video.model');
const ApiError = require('../utils/apiError.util');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sourceTypes = new Set(['cloudinary', 'youtube', 'vimeo', 'twitch']);

const searchVideos = async ({ query = '', creator = '', category = '', sourceType = '', page = 1, limit = 20 }) => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new ApiError(503, 'Video search is temporarily unavailable because the database is disconnected');
  }
  if (sourceType && sourceType !== 'all' && !sourceTypes.has(sourceType)) {
    throw new ApiError(400, 'sourceType is invalid');
  }

  const users = mongoose.connection.db.collection('users');
  const creatorPattern = creator ? new RegExp(escapeRegex(creator), 'i') : null;
  const queryPattern = query ? new RegExp(escapeRegex(query), 'i') : null;
  const userConditions = [];
  if (creatorPattern) userConditions.push({ username: creatorPattern }, { fullName: creatorPattern });
  if (queryPattern) userConditions.push({ username: queryPattern }, { fullName: queryPattern });

  let matchingUsers = [];
  if (userConditions.length) {
    matchingUsers = await users
      .find({ $or: userConditions }, { projection: { username: 1, fullName: 1, avatar: 1 } })
      .toArray();
  }

  const idsFor = (pattern) => matchingUsers
    .filter((user) => pattern.test(user.username || '') || pattern.test(user.fullName || ''))
    .map((user) => user._id);

  const filter = { visibility: 'public', moderationStatus: 'approved' };
  if (category && category.toLowerCase() !== 'all') filter.category = category;
  if (sourceType && sourceType !== 'all') filter.sourceType = sourceType;

  if (creatorPattern) {
    const creatorIds = idsFor(creatorPattern);
    if (!creatorIds.length) return { videos: [], page, limit, total: 0, totalPages: 0 };
    filter.creator = { $in: creatorIds };
  }

  if (queryPattern) {
    const queryCreatorIds = idsFor(queryPattern);
    filter.$or = [
      { title: queryPattern },
      { description: queryPattern },
      ...(queryCreatorIds.length ? [{ creator: { $in: queryCreatorIds } }] : []),
    ];
  }

  const [records, total] = await Promise.all([
    Video.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Video.countDocuments(filter),
  ]);

  const pageCreatorIds = [...new Map(records
    .filter((video) => video.creator)
    .map((video) => [String(video.creator), video.creator])).values()];
  const pageCreators = pageCreatorIds.length
    ? await users.find(
      { _id: { $in: pageCreatorIds } },
      { projection: { username: 1, fullName: 1, avatar: 1 } }
    ).toArray()
    : [];
  const creatorsById = new Map(pageCreators.map((user) => [String(user._id), user]));
  const videos = records.map((video) => ({
    ...video,
    creator: video.creator ? creatorsById.get(String(video.creator)) || String(video.creator) : null,
  }));

  return { videos, page, limit, total, totalPages: Math.ceil(total / limit) };
};

module.exports = { searchVideos };
