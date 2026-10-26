const { z } = require('zod');

const deleteAccountSchema = z.object({
  body: z.object({ password: z.string().min(1).max(128) }).strict(),
});

module.exports = { deleteAccountSchema };
