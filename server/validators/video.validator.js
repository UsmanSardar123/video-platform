const { z } = require('zod');

const metadata = {
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000).optional().default(''),
  category: z.string().trim().min(1).max(60).optional().default('General'),
  visibility: z.enum(['public', 'private', 'unlisted']).optional().default('public'),
};

const signatureSchema = z.object({ body: z.object({}).strict() });
const completeUploadSchema = z.object({
  body: z.object({
    ...metadata,
    publicId: z.string().min(1).max(255),
    format: z.string().trim().min(1).max(12),
  }).strict(),
});

module.exports = { signatureSchema, completeUploadSchema };
