const { z } = require('zod');

const searchQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().max(120).optional().default(''),
    sourceType: z.enum(['cloudinary', 'youtube', 'vimeo', 'twitch']).optional(),
    creator: z.string().trim().max(100).optional().default(''),
    page: z.coerce.number().int().min(1).max(100000).optional().default(1),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  }).strict(),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = { searchQuerySchema };
