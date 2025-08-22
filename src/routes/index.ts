import { Router } from 'express';

const router = Router();

// Add your routes here
// Example:
// router.use('/users', userRoutes);
// router.use('/products', productRoutes);

// Welcome endpoint
router.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      docs: '/api-docs'
    }
  });
});

export default router;