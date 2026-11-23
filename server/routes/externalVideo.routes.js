const express = require('express');
const { authenticate, requireCreator } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const controller = require('../controllers/externalVideo.controller');
const { externalVideoSchema } = require('../validators/externalVideo.validator');

const router = express.Router();
router.post('/', authenticate, requireCreator, validate(externalVideoSchema), controller.submit);
module.exports = router;
