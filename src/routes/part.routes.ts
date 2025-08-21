import { Router } from 'express';
import { partController } from '../controllers/part.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', optionalAuth, partController.findAll);
router.get('/categories', partController.getCategories);
router.get('/manufacturers', partController.getManufacturers);
router.get('/:id', optionalAuth, partController.findById);
router.post('/', authenticate, authorize(Role.ADMIN, Role.MANAGER), partController.create);
router.put('/:id', authenticate, authorize(Role.ADMIN, Role.MANAGER), partController.update);
router.delete('/:id', authenticate, authorize(Role.ADMIN), partController.delete);
router.post('/:id/inventory', authenticate, authorize(Role.ADMIN, Role.MANAGER), partController.updateInventory);

export default router;