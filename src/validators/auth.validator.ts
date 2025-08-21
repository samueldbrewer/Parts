import Joi from 'joi';

export const registerSchema = Joi.object({
  email: Joi.string().email().required().trim().lowercase(),
  username: Joi.string().alphanum().min(3).max(30).required().trim().lowercase(),
  password: Joi.string().min(8).max(128).required()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
    .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  firstName: Joi.string().trim().max(100),
  lastName: Joi.string().trim().max(100),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().trim().lowercase(),
  username: Joi.string().alphanum().min(3).max(30).trim().lowercase(),
  password: Joi.string().required(),
}).or('email', 'username');

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required()
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
    .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
});