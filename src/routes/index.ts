import { Router } from 'express';
import authRoutes from './auth.routes';
import partRoutes from './part.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/parts', partRoutes);

export default router;