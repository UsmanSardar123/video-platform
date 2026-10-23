
const { z } = require('zod');

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/)
  .transform((value) => value.toLowerCase());

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());

const passwordSchema = z.string().min(8).max(128);

const registerSchema = z.object({
  body: z.object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    fullName: z.string().trim().max(80).optional(),
  }).strict(),
});

const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  }).strict(),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1),
  }).strict(),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
};
