const { searchVideos } = require('../services/search.service');

const search = async (req, res, next) => {
  try {
    const result = await searchVideos(req.query);
    res.status(200).json({ success: true, data: result.videos, pagination: {
      page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages,
    } });
  } catch (error) { next(error); }
};

module.exports = { search };
