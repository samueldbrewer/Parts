import OpenAI from 'openai';
import sharp from 'sharp';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { WebSearchService } from './web-search.service';

interface IdentifyOptions {
  includeSpecs?: boolean;
  includePricing?: boolean;
  includeAvailability?: boolean;
}

interface ExtractedPartData {
  type: string;
  manufacturer: string | null;
  numbers: {
    partNumber?: string;
    modelNumber?: string;
    serialNumber?: string;
    otherNumbers?: string[];
  };
  specifications: any;
  physicalAttributes: any;
  condition: string;
  equipmentType: string | null;
}

interface PartMatch {
  partNumber: string;
  manufacturer?: string;
  type?: string;
  matchType: 'exact' | 'similar' | 'specification';
  confidence: number;
  specifications?: any;
}

interface EnrichedPart extends PartMatch {
  availability?: any;
  pricing?: any;
  crossReferences?: string[];
  manuals?: any[];
}

export class VisualIdentificationService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  /**
   * Main visual identification endpoint
   */
  async identifyPart(imageBuffer: Buffer, options: IdentifyOptions = {}) {
    try {
      const startTime = Date.now();

      // Step 1: Pre-process image
      const processedImage = await this.preprocessImage(imageBuffer);

      // Step 2: Create hash for caching
      const imageHash = this.createImageHash(processedImage);

      // Check cache first
      const cached = await this.getCachedResult(imageHash);
      if (cached) {
        logger.info('Returning cached vision result', { imageHash });
        return cached;
      }

      // Step 3: Analyze with Vision API
      const visionAnalysis = await this.analyzeWithVision(processedImage);

      // Step 4: Extract structured data
      const extractedData = await this.extractPartData(visionAnalysis);

      // Step 5: Search for matches
      const matches = await this.findMatches(extractedData);

      // Step 6: Enrich with additional data
      const enriched = await this.enrichPartData(matches, options);

      const processingTime = Date.now() - startTime;

      const result = {
        success: true,
        confidence: this.calculateConfidence(visionAnalysis, matches),
        primaryMatch: enriched[0] || null,
        alternativeMatches: enriched.slice(1, 5),
        extractedInfo: extractedData,
        metadata: {
          processedAt: new Date(),
          imageQuality: visionAnalysis.imageQuality || 'good',
          analysisTime: processingTime,
          imageHash,
        },
      };

      // Cache the result
      await this.cacheResult(imageHash, result);

      // Log to database for learning
      await this.logIdentification(result, imageHash);

      return result;
    } catch (error) {
      logger.error('Visual identification failed', { error });
      throw error;
    }
  }

  /**
   * Pre-process image for better recognition
   */
  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    try {
      // Enhance image quality
      const enhanced = await sharp(buffer)
        .resize(2048, 2048, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .normalize() // Improve contrast
        .sharpen() // Enhance edges
        .toBuffer();

      return enhanced;
    } catch (error) {
      logger.warn('Image preprocessing failed, using original', { error });
      return buffer;
    }
  }

  /**
   * Create hash of image for caching
   */
  private createImageHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Get cached result if exists
   */
  private async getCachedResult(imageHash: string): Promise<any | null> {
    try {
      const cached = await prisma.partIdentification.findFirst({
        where: { imageHash },
        orderBy: { createdAt: 'desc' },
      });

      if (cached && cached.createdAt > new Date(Date.now() - 3600000)) {
        // 1 hour cache
        return cached.identificationData;
      }
    } catch (error) {
      logger.warn('Cache lookup failed', { error });
    }
    return null;
  }

  /**
   * Analyze image with OpenAI Vision
   */
  private async analyzeWithVision(imageBuffer: Buffer) {
    const base64Image = imageBuffer.toString('base64');

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert at identifying HVAC, appliance, and equipment parts. 
                     Analyze the image and extract ALL visible information.
                     Return your analysis as valid JSON only.`,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Identify this part and extract:
                       1. partType: Type of part (capacitor, motor, contactor, board, etc.)
                       2. manufacturer: Manufacturer name if visible
                       3. partNumber: Main part number if visible
                       4. modelNumber: Model number if different from part number
                       5. specifications: Object with any specs (voltage, capacitance, HP, MFD, etc.)
                       6. physicalCharacteristics: Object with color, shape, terminals, size
                       7. visibleNumbers: Array of ALL other visible numbers/codes
                       8. condition: Good, Damaged, Burned, Corroded, Unknown
                       9. probableEquipment: Type of equipment this likely belongs to
                       10. confidence: Your confidence level 0-1
                       11. imageQuality: good, fair, poor
                       
                       Return ONLY valid JSON with these fields.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      });

      const content = response.choices[0].message.content || '{}';

      // Parse and validate JSON
      try {
        return JSON.parse(content);
      } catch (parseError) {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Failed to parse Vision API response');
      }
    } catch (error) {
      logger.error('Vision API call failed', { error });
      throw new Error('Vision analysis failed');
    }
  }

  /**
   * Extract structured part data
   */
  private async extractPartData(visionAnalysis: any): Promise<ExtractedPartData> {
    return {
      type: visionAnalysis.partType || 'unknown',
      manufacturer: this.normalizeManufacturer(visionAnalysis.manufacturer),
      numbers: {
        partNumber: visionAnalysis.partNumber,
        modelNumber: visionAnalysis.modelNumber,
        serialNumber: visionAnalysis.serialNumber,
        otherNumbers: visionAnalysis.visibleNumbers || [],
      },
      specifications: visionAnalysis.specifications || {},
      physicalAttributes: visionAnalysis.physicalCharacteristics || {},
      condition: visionAnalysis.condition || 'Unknown',
      equipmentType: visionAnalysis.probableEquipment,
    };
  }

  /**
   * Normalize manufacturer name
   */
  private normalizeManufacturer(manufacturer: string | null): string | null {
    if (!manufacturer) return null;

    const normalized = manufacturer.toUpperCase().trim();

    // Common manufacturer mappings
    const mappings: Record<string, string> = {
      GE: 'General Electric',
      CARRIER: 'Carrier',
      TRANE: 'Trane',
      LENNOX: 'Lennox',
      RHEEM: 'Rheem',
      GOODMAN: 'Goodman',
      YORK: 'York',
      AMANA: 'Amana',
    };

    return mappings[normalized] || manufacturer;
  }

  /**
   * Find matching parts in database and via search
   */
  private async findMatches(data: ExtractedPartData): Promise<PartMatch[]> {
    const matches: PartMatch[] = [];

    // 1. Try exact part number match in database
    if (data.numbers.partNumber) {
      try {
        const exactMatch = await prisma.partsCatalog.findFirst({
          where: { partNumber: data.numbers.partNumber },
        });

        if (exactMatch) {
          matches.push({
            partNumber: exactMatch.partNumber,
            manufacturer: exactMatch.manufacturer || undefined,
            type: exactMatch.type || undefined,
            matchType: 'exact',
            confidence: 0.95,
            specifications: exactMatch.specifications,
          });
        }
      } catch (error) {
        logger.warn('Database search failed', { error });
      }
    }

    // 2. Try SERP search for part information
    if (data.numbers.partNumber || data.numbers.modelNumber) {
      const searchTerm = data.numbers.partNumber || data.numbers.modelNumber || '';
      const serpMatches = await this.serpSearch(searchTerm, data.type);
      matches.push(...serpMatches);
    }

    // 3. Try specification matching if no direct matches
    if (matches.length === 0 && data.specifications) {
      const specMatches = await this.searchBySpecifications(data.type, data.specifications);
      matches.push(...specMatches);
    }

    // Remove duplicates and sort by confidence
    const uniqueMatches = this.deduplicateMatches(matches);
    return uniqueMatches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Search using SERP API
   */
  private async serpSearch(searchTerm: string, partType: string): Promise<PartMatch[]> {
    try {
      const query = `${searchTerm} ${partType} specifications "part number"`;
      const results = await WebSearchService.search(query);

      const matches: PartMatch[] = [];

      // Parse first few results for part information
      for (const result of results.results.slice(0, 3)) {
        // Extract part numbers from snippets
        const partNumberMatch = result.snippet.match(/\b[A-Z0-9]+-[A-Z0-9]+\b/g);
        if (partNumberMatch) {
          matches.push({
            partNumber: partNumberMatch[0],
            matchType: 'similar',
            confidence: 0.7,
            specifications: this.extractSpecsFromText(result.snippet),
          });
        }
      }

      return matches;
    } catch (error) {
      logger.warn('SERP search failed', { error });
      return [];
    }
  }

  /**
   * Search by specifications
   */
  private async searchBySpecifications(type: string, specs: any): Promise<PartMatch[]> {
    try {
      // Build specification search query
      const specParts = [];
      if (specs.voltage) specParts.push(`${specs.voltage}V`);
      if (specs.capacitance) specParts.push(`${specs.capacitance}MFD`);
      if (specs.hp) specParts.push(`${specs.hp}HP`);

      if (specParts.length === 0) return [];

      const query = `${type} ${specParts.join(' ')} replacement`;
      const results = await WebSearchService.search(query);

      const matches: PartMatch[] = [];
      for (const result of results.results.slice(0, 2)) {
        const partNumberMatch = result.snippet.match(/\b[A-Z0-9]+-[A-Z0-9]+\b/g);
        if (partNumberMatch) {
          matches.push({
            partNumber: partNumberMatch[0],
            matchType: 'specification',
            confidence: 0.6,
            specifications: specs,
          });
        }
      }

      return matches;
    } catch (error) {
      logger.warn('Specification search failed', { error });
      return [];
    }
  }

  /**
   * Extract specifications from text
   */
  private extractSpecsFromText(text: string): any {
    const specs: any = {};

    // Voltage
    const voltageMatch = text.match(/(\d+)\s*V(?:olts?)?/i);
    if (voltageMatch) specs.voltage = parseInt(voltageMatch[1]);

    // Capacitance
    const mfdMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:MFD|µF|uF)/i);
    if (mfdMatch) specs.capacitance = parseFloat(mfdMatch[1]);

    // Horsepower
    const hpMatch = text.match(/(\d+(?:\/\d+)?)\s*HP/i);
    if (hpMatch) specs.hp = hpMatch[1];

    return specs;
  }

  /**
   * Deduplicate matches
   */
  private deduplicateMatches(matches: PartMatch[]): PartMatch[] {
    const seen = new Set<string>();
    return matches.filter((match) => {
      if (seen.has(match.partNumber)) return false;
      seen.add(match.partNumber);
      return true;
    });
  }

  /**
   * Enrich part data with specifications and availability
   */
  private async enrichPartData(
    matches: PartMatch[],
    options: IdentifyOptions,
  ): Promise<EnrichedPart[]> {
    const enrichedPromises = matches.slice(0, 5).map(async (match) => {
      const enriched: EnrichedPart = { ...match };

      if (options.includePricing) {
        enriched.pricing = await this.getPricing(match.partNumber);
      }

      if (options.includeAvailability) {
        enriched.availability = await this.checkAvailability(match.partNumber);
      }

      // Always try to get cross-references
      enriched.crossReferences = await this.getCrossReferences(match.partNumber);

      return enriched;
    });

    return Promise.all(enrichedPromises);
  }

  /**
   * Get pricing information
   */
  private async getPricing(partNumber: string): Promise<any> {
    try {
      const query = `${partNumber} price USD "in stock"`;
      const results = await WebSearchService.search(query);

      const prices: any[] = [];
      for (const result of results.results.slice(0, 3)) {
        const priceMatch = result.snippet.match(/\$(\d+(?:\.\d{2})?)/);
        if (priceMatch) {
          prices.push({
            source: new URL(result.url).hostname,
            price: parseFloat(priceMatch[1]),
            url: result.url,
          });
        }
      }

      return {
        lowestPrice: prices.length > 0 ? Math.min(...prices.map((p) => p.price)) : null,
        averagePrice:
          prices.length > 0 ? prices.reduce((a, b) => a + b.price, 0) / prices.length : null,
        sources: prices,
      };
    } catch (error) {
      logger.warn('Pricing lookup failed', { error });
      return null;
    }
  }

  /**
   * Check availability
   */
  private async checkAvailability(partNumber: string): Promise<any> {
    try {
      const query = `${partNumber} "in stock" availability`;
      const results = await WebSearchService.search(query);

      const availability: any[] = [];
      for (const result of results.results.slice(0, 3)) {
        const inStock = result.snippet.toLowerCase().includes('in stock');
        availability.push({
          source: new URL(result.url).hostname,
          inStock,
          url: result.url,
        });
      }

      return {
        availableNow: availability.some((a) => a.inStock),
        sources: availability,
      };
    } catch (error) {
      logger.warn('Availability check failed', { error });
      return null;
    }
  }

  /**
   * Get cross-references
   */
  private async getCrossReferences(partNumber: string): Promise<string[]> {
    try {
      const query = `${partNumber} "cross reference" "replaces" "supersedes"`;
      const results = await WebSearchService.search(query);

      const references = new Set<string>();
      for (const result of results.results.slice(0, 2)) {
        const matches = result.snippet.match(/\b[A-Z0-9]+-[A-Z0-9]+\b/g);
        if (matches) {
          matches.forEach((m) => {
            if (m !== partNumber) references.add(m);
          });
        }
      }

      return Array.from(references).slice(0, 5);
    } catch (error) {
      logger.warn('Cross-reference lookup failed', { error });
      return [];
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(vision: any, matches: PartMatch[]): number {
    let score = 0;

    // Base confidence from Vision API
    score += (vision.confidence || 0.5) * 0.4;

    // Boost for exact part number match
    if (matches[0]?.matchType === 'exact') {
      score += 0.3;
    } else if (matches[0]?.matchType === 'similar') {
      score += 0.2;
    } else if (matches[0]?.matchType === 'specification') {
      score += 0.1;
    }

    // Boost for good image quality
    if (vision.imageQuality === 'good') {
      score += 0.1;
    } else if (vision.imageQuality === 'fair') {
      score += 0.05;
    }

    // Boost for having matches
    if (matches.length > 0) {
      score += 0.1;
    }

    // Boost for multiple corroborating matches
    if (matches.length > 2) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Cache result
   */
  private async cacheResult(imageHash: string, result: any): Promise<void> {
    try {
      await prisma.partIdentification.create({
        data: {
          imageHash,
          identifiedPartNumber: result.primaryMatch?.partNumber,
          confidenceScore: result.confidence,
          identificationData: result,
          extractionData: result.extractedInfo,
        },
      });
    } catch (error) {
      logger.warn('Failed to cache result', { error });
    }
  }

  /**
   * Log identification for learning
   */
  private async logIdentification(result: any, imageHash: string): Promise<void> {
    try {
      logger.info('Part identification completed', {
        imageHash,
        partNumber: result.primaryMatch?.partNumber,
        confidence: result.confidence,
        matchType: result.primaryMatch?.matchType,
      });
    } catch (error) {
      logger.warn('Failed to log identification', { error });
    }
  }
}
