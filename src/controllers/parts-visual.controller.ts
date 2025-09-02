import { Request, Response, NextFunction } from 'express';
import { VisualIdentificationService } from '../services/visual-identification.service';
import { logger } from '../utils/logger';

export class PartsVisualController {
  private visualService: VisualIdentificationService;

  constructor() {
    this.visualService = new VisualIdentificationService();
  }

  /**
   * POST /api/v1/parts/identify/visual
   * Identify a part from an uploaded image
   */
  identifyVisual = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if image was uploaded
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No image provided. Please upload an image file.',
        });
        return;
      }

      const imageBuffer = req.file.buffer;

      // Check file size (max 10MB)
      if (imageBuffer.length > 10 * 1024 * 1024) {
        res.status(400).json({
          success: false,
          error: 'Image file too large. Maximum size is 10MB.',
        });
        return;
      }

      // Get options from query params
      const options = {
        includeSpecs: req.query.includeSpecs !== 'false',
        includePricing: req.query.includePricing === 'true',
        includeAvailability: req.query.includeAvailability === 'true',
      };

      logger.info('Processing visual identification request', {
        fileSize: imageBuffer.length,
        mimeType: req.file.mimetype,
        options,
      });

      // Perform identification
      const result = await this.visualService.identifyPart(imageBuffer, options);

      // Return successful response
      res.json(result);
    } catch (error) {
      logger.error('Visual identification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('Vision analysis failed')) {
          res.status(503).json({
            success: false,
            error: 'Vision service temporarily unavailable. Please try again later.',
          });
          return;
        }

        if (error.message.includes('Invalid image')) {
          res.status(400).json({
            success: false,
            error: 'Invalid image format. Please upload a valid image file.',
          });
          return;
        }
      }

      // Generic error response
      res.status(500).json({
        success: false,
        error: 'Failed to identify part. Please try again.',
      });
    }
  };

  /**
   * POST /api/v1/parts/identify/nameplate
   * Extract information from equipment nameplate
   */
  identifyNameplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No image provided. Please upload a nameplate image.',
        });
        return;
      }

      const imageBuffer = req.file.buffer;

      logger.info('Processing nameplate extraction request', {
        fileSize: imageBuffer.length,
        mimeType: req.file.mimetype,
      });

      // For now, use the same visual identification service
      // In the future, we can create a specialized nameplate service
      const result = await this.visualService.identifyPart(imageBuffer, {
        includeSpecs: true,
        includePricing: false,
        includeAvailability: false,
      });

      // Format response for nameplate specific data
      const nameplateData = {
        success: true,
        equipment: {
          manufacturer: result.extractedInfo?.manufacturer,
          model: result.extractedInfo?.numbers?.modelNumber,
          serial: result.extractedInfo?.numbers?.serialNumber,
        },
        specifications: result.extractedInfo?.specifications || {},
        allNumbers: [
          result.extractedInfo?.numbers?.partNumber,
          result.extractedInfo?.numbers?.modelNumber,
          ...(result.extractedInfo?.numbers?.otherNumbers || []),
        ].filter(Boolean),
        confidence: result.confidence,
        metadata: result.metadata,
      };

      res.json(nameplateData);
    } catch (error) {
      logger.error('Nameplate extraction failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to extract nameplate information. Please try again.',
      });
    }
  };

  /**
   * POST /api/v1/parts/compare/visual
   * Compare two part images
   */
  comparePartsEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if exactly 2 images were uploaded
      const files = req.files as Express.Multer.File[];

      if (!files || files.length !== 2) {
        res.status(400).json({
          success: false,
          error: 'Please upload exactly 2 images to compare.',
        });
        return;
      }

      const [image1, image2] = files;

      logger.info('Processing part comparison request', {
        image1Size: image1.buffer.length,
        image2Size: image2.buffer.length,
      });

      // Identify both parts
      const [part1, part2] = await Promise.all([
        this.visualService.identifyPart(image1.buffer, { includeSpecs: true }),
        this.visualService.identifyPart(image2.buffer, { includeSpecs: true }),
      ]);

      // Compare the parts
      const comparison = this.comparePartsLogic(part1, part2);

      res.json({
        success: true,
        comparison,
        part1Summary: {
          partNumber: part1.primaryMatch?.partNumber,
          type: part1.extractedInfo?.type,
          manufacturer: part1.extractedInfo?.manufacturer,
          confidence: part1.confidence,
        },
        part2Summary: {
          partNumber: part2.primaryMatch?.partNumber,
          type: part2.extractedInfo?.type,
          manufacturer: part2.extractedInfo?.manufacturer,
          confidence: part2.confidence,
        },
      });
    } catch (error) {
      logger.error('Part comparison failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to compare parts. Please try again.',
      });
    }
  };

  /**
   * POST /api/v1/parts/identify/damaged
   * Identify a damaged or burned part
   */
  identifyDamaged = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No image provided. Please upload an image of the damaged part.',
        });
        return;
      }

      const imageBuffer = req.file.buffer;
      const context = req.body.context || {}; // Additional context like equipment type

      logger.info('Processing damaged part identification', {
        fileSize: imageBuffer.length,
        context,
      });

      // Use visual identification with lower confidence threshold
      const result = await this.visualService.identifyPart(imageBuffer, {
        includeSpecs: true,
        includePricing: true,
        includeAvailability: true,
      });

      // Add context about damage
      const damagedPartResult = {
        ...result,
        damageAssessment: {
          condition: result.extractedInfo?.condition || 'Unknown',
          identificationMethod: result.confidence > 0.5 ? 'visual_match' : 'specification_match',
          recommendedAction: this.getRecommendedAction(result),
        },
        warning:
          result.confidence < 0.7
            ? 'Low confidence due to damage. Please verify part compatibility before ordering.'
            : undefined,
      };

      res.json(damagedPartResult);
    } catch (error) {
      logger.error('Damaged part identification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to identify damaged part. Please try again.',
      });
    }
  };

  /**
   * Compare two identified parts
   */
  private comparePartsLogic(part1: any, part2: any): any {
    const match = {
      isMatch: false,
      confidence: 0,
      matchType: 'none',
      differences: [] as string[],
      similarities: [] as string[],
    };

    // Check if part numbers match
    if (part1.primaryMatch?.partNumber === part2.primaryMatch?.partNumber) {
      match.isMatch = true;
      match.matchType = 'exact';
      match.confidence = Math.min(part1.confidence, part2.confidence);
      match.similarities.push('Part numbers match');
    }

    // Check if types match
    if (part1.extractedInfo?.type === part2.extractedInfo?.type) {
      match.similarities.push('Same part type');
      match.confidence += 0.2;
    } else {
      match.differences.push('Different part types');
    }

    // Check manufacturers
    if (part1.extractedInfo?.manufacturer === part2.extractedInfo?.manufacturer) {
      match.similarities.push('Same manufacturer');
      match.confidence += 0.1;
    } else {
      match.differences.push('Different manufacturers');
    }

    // Check specifications
    const specs1 = part1.extractedInfo?.specifications || {};
    const specs2 = part2.extractedInfo?.specifications || {};

    for (const key in specs1) {
      if (specs2[key] === specs1[key]) {
        match.similarities.push(`Same ${key}: ${specs1[key]}`);
      } else if (specs2[key]) {
        match.differences.push(`Different ${key}: ${specs1[key]} vs ${specs2[key]}`);
      }
    }

    // If not exact match but similar specs, might be compatible
    if (!match.isMatch && match.similarities.length > 2) {
      match.matchType = 'compatible';
      match.confidence = Math.max(0.5, match.confidence);
    }

    return match;
  }

  /**
   * Get recommended action for damaged part
   */
  private getRecommendedAction(result: any): string {
    if (result.confidence > 0.8) {
      return 'Part identified with high confidence. Safe to order replacement.';
    } else if (result.confidence > 0.5) {
      return 'Part likely identified. Recommend verifying with equipment model number before ordering.';
    } else if (result.primaryMatch) {
      return 'Low confidence match found. Recommend consulting with technician or checking equipment manual.';
    } else {
      return 'Unable to identify part. Try taking additional photos or check equipment manual for part number.';
    }
  }
}
