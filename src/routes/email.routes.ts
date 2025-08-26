import { Router } from 'express';
import { body } from 'express-validator';
import { emailController } from '../controllers/email.controller';
import { validateRequest } from '../middleware/validation.middleware';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// Apply rate limiting to all email routes
router.use(apiLimiter);

// Email health check
router.get('/health', emailController.getHealth);

// Send email
router.post(
  '/send',
  [
    body('to').isEmail().normalizeEmail().withMessage('Valid email address is required'),
    body('subject')
      .isString()
      .isLength({ min: 1, max: 200 })
      .withMessage('Subject must be between 1 and 200 characters'),
    body('text')
      .isString()
      .isLength({ min: 1, max: 10000 })
      .withMessage('Text content must be between 1 and 10000 characters'),
    body('html')
      .optional()
      .isString()
      .isLength({ max: 20000 })
      .withMessage('HTML content must not exceed 20000 characters'),
    validateRequest,
  ],
  emailController.sendEmail,
);

// Get inbox (cached)
router.get('/inbox', emailController.getInbox);

// Refresh inbox (force fetch)
router.post('/refresh', emailController.refreshInbox);

export default router;
