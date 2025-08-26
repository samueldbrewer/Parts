import { Router } from 'express';
import { migrationController } from '../controllers/migration.controller';

const router = Router();

/**
 * @route   POST /api/v1/admin/migrate
 * @desc    Run database migrations manually
 * @access  Private (requires master API key)
 */
router.post('/migrate', migrationController.runMigrations);

export default router;
