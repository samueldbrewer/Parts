import { Router } from 'express';
import voiceRoutes from './voice.routes';
import adminRoutes from './admin.routes';
import emailRoutes from './email.routes';

const router = Router();

// Add your routes here
// Example:
// router.use('/users', userRoutes);
// router.use('/products', productRoutes);

// Voice endpoints
router.use('/voice', voiceRoutes);

// Email endpoints
router.use('/email', emailRoutes);

// Admin endpoints
router.use('/admin', adminRoutes);

// Welcome endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      docs: '/api-docs',
      voice: {
        token: '/api/v1/voice/token',
        websocket: '/api/v1/voice/realtime',
        sessions: '/api/v1/voice/sessions',
        usage: '/api/v1/voice/usage',
      },
      email: {
        health: '/api/v1/email/health',
        send: '/api/v1/email/send',
        inbox: '/api/v1/email/inbox',
        refresh: '/api/v1/email/refresh',
      },
    },
  });
});

export default router;
