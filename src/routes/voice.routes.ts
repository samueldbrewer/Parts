import { Router } from 'express';
import { voiceController } from '../controllers/voice.controller';
import { optionalAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * @route   GET /api/v1/voice/token
 * @desc    Get WebSocket connection token
 * @access  Public (with optional auth)
 */
router.get('/token', optionalAuth, voiceController.getConnectionToken);

/**
 * @route   GET /api/v1/voice/sessions
 * @desc    Get voice session history
 * @access  Private
 */
router.get('/sessions', optionalAuth, voiceController.getSessionHistory);

/**
 * @route   GET /api/v1/voice/sessions/:sessionId
 * @desc    Get specific session details
 * @access  Private
 */
router.get('/sessions/:sessionId', optionalAuth, voiceController.getSessionDetails);

/**
 * @route   GET /api/v1/voice/usage
 * @desc    Get usage statistics
 * @access  Private
 */
router.get('/usage', optionalAuth, voiceController.getUsageStats);

/**
 * @route   GET /api/v1/voice/health
 * @desc    Voice service health check
 * @access  Public
 */
router.get('/health', voiceController.healthCheck);

// Note: WebSocket endpoint /api/v1/voice/realtime is handled at the server level

export default router;
