const express = require('express');
const { validate } = require('../middleware/validate.middleware');
const controller = require('../controllers/search.controller');
const { searchQuerySchema } = require('../validators/search.validator');

const router = express.Router();
router.get('/', validate(searchQuerySchema), controller.search);
module.exports = router;
