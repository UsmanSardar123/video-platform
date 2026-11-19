const ApiError = require('../utils/apiError.util');
const searchService = require('../services/search.service');

const parsePositiveInteger = (value, name, fallback, maximum) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new ApiError(400, `${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new ApiError(400, `${name} must be a positive integer`);
  if (maximum && parsed > maximum) throw new ApiError(400, `${name} must be between 1 and ${maximum}`);
  return parsed;
};

const parseOptionalText = (value, name, maxLength) => {
  if (value === undefined) return '';
  if (typeof value !== 'string') throw new ApiError(400, `${name} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new ApiError(400, `${name} must be ${maxLength} characters or fewer`);
  return trimmed;
};

const handleSearchVideos = async (req, res, next) => {
  try {
    const page = parsePositiveInteger(req.query.page, 'page', 1);
    const limit = parsePositiveInteger(req.query.limit, 'limit', 20, 50);
    const query = parseOptionalText(req.query.q, 'q', 100);
    const creator = parseOptionalText(req.query.creator, 'creator', 100);
    const category = parseOptionalText(req.query.category, 'category', 100);
    const sourceType = parseOptionalText(req.query.sourceType, 'sourceType', 20);

    const result = await searchService.searchVideos({
      query,
      creator,
      category,
      sourceType,
      page,
      limit,
    });

    res.status(200).json({
      success: true,
      data: result.videos,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { handleSearchVideos };
