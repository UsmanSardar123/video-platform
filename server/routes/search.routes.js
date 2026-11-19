const express = require('express');
const { handleSearchVideos } = require('../controllers/search.controller');

const router = express.Router();

router.get('/', handleSearchVideos);

module.exports = router;
