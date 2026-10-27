const { z } = require('zod');

const deleteAccountSchema = z.object({
  body: z.object({ password: z.string().min(1).max(128) }).strict(),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
  }).strict(),
});

const changeEmailSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required to confirm change').max(128),
    email: z
      .string()
      .trim()
      .email('Please enter a valid email address')
      .max(254)
      .transform((val) => val.toLowerCase()),
  }).strict(),
});

module.exports = {
  deleteAccountSchema,
  changePasswordSchema,
  changeEmailSchema,
};
