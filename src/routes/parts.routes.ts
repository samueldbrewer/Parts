import { Router } from 'express';
import { PartsVisualController } from '../controllers/parts-visual.controller';
import { uploadSingle, uploadMultiple, handleUploadError } from '../middleware/upload.middleware';
import { apiKeyAuth } from '../middleware/auth.middleware';

const router = Router();
const partsVisualController = new PartsVisualController();

/**
 * @route   POST /api/v1/parts/identify/visual
 * @desc    Identify a part from an uploaded image
 * @access  Public (or add apiKeyAuth for protection)
 */
router.post(
  '/identify/visual',
  uploadSingle,
  handleUploadError,
  partsVisualController.identifyVisual,
);

/**
 * @route   POST /api/v1/parts/identify/nameplate
 * @desc    Extract information from equipment nameplate
 * @access  Public
 */
router.post(
  '/identify/nameplate',
  uploadSingle,
  handleUploadError,
  partsVisualController.identifyNameplate,
);

/**
 * @route   POST /api/v1/parts/compare/visual
 * @desc    Compare two part images
 * @access  Public
 */
router.post(
  '/compare/visual',
  uploadMultiple,
  handleUploadError,
  partsVisualController.comparePartsEndpoint,
);

/**
 * @route   POST /api/v1/parts/identify/damaged
 * @desc    Identify a damaged or burned part
 * @access  Public
 */
router.post(
  '/identify/damaged',
  uploadSingle,
  handleUploadError,
  partsVisualController.identifyDamaged,
);

export default router;
