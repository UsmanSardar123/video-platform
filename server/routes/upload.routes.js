const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const controller = require('../controllers/upload.controller');
const { signatureSchema, completeUploadSchema } = require('../validators/video.validator');

const router = express.Router();
router.post('/signature', authenticate, validate(signatureSchema), controller.authorize);
router.post('/avatar-signature', authenticate, validate(signatureSchema), controller.authorizeAvatar);
router.post('/complete', authenticate, validate(completeUploadSchema), controller.complete);
module.exports = router;
