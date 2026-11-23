const express = require('express');
const { authenticate, requireCreator } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const controller = require('../controllers/upload.controller');
const { signatureSchema, completeUploadSchema } = require('../validators/video.validator');

const router = express.Router();
router.post('/signature', authenticate, requireCreator, validate(signatureSchema), controller.authorize);
router.post('/complete', authenticate, requireCreator, validate(completeUploadSchema), controller.complete);
router.post('/avatar-signature', authenticate, controller.avatarAuthorize);
module.exports = router;
