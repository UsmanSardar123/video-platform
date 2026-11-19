const { z } = require('zod');

const externalVideoSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(150),
    description: z.string().trim().max(5000).optional().default(''),
    category: z.string().trim().min(1).max(60).optional().default('Other'),
    visibility: z.enum(['public', 'private', 'unlisted']).optional().default('public'),
    url: z.string().trim().url().max(2048),
  }).strict(),
});

module.exports = { externalVideoSchema };
