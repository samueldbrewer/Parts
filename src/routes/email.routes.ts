import { Router } from 'express';
import { body, query } from 'express-validator';
import { emailController } from '../controllers/email.controller';

const router = Router();

// Mock middleware - replace with your actual middleware imports
const validateRequest = (req: any, res: any, next: any) => {
  // Simple validation middleware mock
  // Replace with your actual express-validator middleware
  next();
};

const apiLimiter = (req: any, res: any, next: any) => {
  // Simple rate limiter mock
  // Replace with your actual rate limiting middleware
  next();
};

// Apply rate limiting to all email routes (except health check)
router.use('/send', apiLimiter);
router.use('/refresh', apiLimiter);
router.use('/test', apiLimiter);

/**
 * Email service health check - no rate limiting
 * GET /api/email/health
 */
router.get('/health', emailController.getHealth);

/**
 * Manual retry initialization endpoint for debugging
 * POST /api/email/retry-init
 */
router.post('/retry-init', emailController.retryInit);

/**
 * Test route for quick connectivity check
 * POST /api/email/test
 */
router.post(
  '/test',
  [
    body('to').optional().isEmail().normalizeEmail().withMessage('Valid email address is required'),
    body('subject').optional().isString().withMessage('Subject must be a string'),
    body('text').optional().isString().withMessage('Text must be a string'),
    validateRequest,
  ],
  emailController.sendEmail,
);

/**
 * Send email endpoint with comprehensive validation
 * POST /api/email/send
 */
router.post(
  '/send',
  [
    // Email validation
    body('to')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email address is required')
      .isLength({ max: 254 })
      .withMessage('Email address too long'),

    // Subject validation
    body('subject')
      .isString()
      .withMessage('Subject must be a string')
      .isLength({ min: 1, max: 200 })
      .withMessage('Subject must be between 1 and 200 characters')
      .trim()
      .escape(), // Sanitize for security

    // Text content validation
    body('text')
      .isString()
      .withMessage('Text content must be a string')
      .isLength({ min: 1, max: 10000 })
      .withMessage('Text content must be between 1 and 10000 characters')
      .trim(),

    // HTML content validation (optional)
    body('html')
      .optional()
      .isString()
      .withMessage('HTML content must be a string')
      .isLength({ max: 50000 })
      .withMessage('HTML content must not exceed 50000 characters'),

    validateRequest,
  ],
  emailController.sendEmail,
);

/**
 * Get inbox emails (cached)
 * GET /api/email/inbox?limit=10
 */
router.get(
  '/inbox',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be an integer between 1 and 100')
      .toInt(),
    validateRequest,
  ],
  emailController.getInbox,
);

/**
 * Refresh inbox (force fetch from IMAP)
 * POST /api/email/refresh
 */
router.post('/refresh', emailController.refreshInbox);

// Additional debugging routes for development/testing

/**
 * Get detailed service status for debugging
 * GET /api/email/debug/status
 */
router.get('/debug/status', (req, res) => {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        EMAIL_USER: process.env.EMAIL_USER ? '***configured***' : 'missing',
        EMAIL_PASS: process.env.EMAIL_PASS ? '***configured***' : 'missing',
        EMAIL_FROM: process.env.EMAIL_FROM || 'using EMAIL_USER',
        SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
        SMTP_PORT: process.env.SMTP_PORT || '587',
        IMAP_HOST: process.env.IMAP_HOST || 'imap.gmail.com',
        IMAP_PORT: process.env.IMAP_PORT || '993',
      },
      service: {
        configured: !!emailController,
        // Add more debug info as needed
      },
    };

    res.json({
      success: true,
      data: debugInfo,
      message: 'Debug information retrieved',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve debug information',
    });
  }
});

/**
 * Test SMTP configuration without sending email
 * GET /api/email/debug/smtp-test
 */
router.get('/debug/smtp-test', (req, res) => {
  // This would implement a simple SMTP connection test
  // without actually sending an email
  res.json({
    success: true,
    message: 'SMTP test endpoint - implement connection test here',
    data: {
      note: 'This endpoint can be used to test SMTP connectivity',
      implementation: 'Add transporter.verify() call here for actual testing',
    },
  });
});

export default router;

// Export route definitions for documentation
export const emailRouteDefinitions = {
  'GET /health': 'Check email service health status',
  'POST /retry-init': 'Manually retry email service initialization',
  'POST /test': 'Test email functionality (development)',
  'POST /send': 'Send an email',
  'GET /inbox': 'Get cached inbox emails',
  'POST /refresh': 'Force refresh inbox from IMAP server',
  'GET /debug/status': 'Get detailed debug information',
  'GET /debug/smtp-test': 'Test SMTP connectivity',
};
