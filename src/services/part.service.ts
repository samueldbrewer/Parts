import { Part, Prisma, InventoryAction } from '@prisma/client';
import { prisma } from '../config/database';
import { NotFoundError, ConflictError, ValidationError } from '../errors/AppError';
import { logger } from '../utils/logger';

export interface CreatePartInput {
  partNumber: string;
  name: string;
  description?: string;
  manufacturer?: string;
  category: string;
  subcategory?: string;
  price: number;
  cost?: number;
  quantity?: number;
  minQuantity?: number;
  location?: string;
  barcode?: string;
  sku?: string;
  weight?: number;
  dimensions?: any;
  specifications?: any;
  images?: string[];
  tags?: string[];
  status?: string;
}

export interface UpdatePartInput extends Partial<CreatePartInput> {}

export interface QueryPartsInput {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  category?: string;
  subcategory?: string;
  manufacturer?: string;
  status?: string;
  minPrice?: number;
  maxPrice?: number;
  minQuantity?: number;
  tags?: string | string[];
}

export interface InventoryUpdateInput {
  type: InventoryAction;
  quantity: number;
  reference?: string;
  notes?: string;
}

export class PartService {
  async create(data: CreatePartInput, userId?: string): Promise<Part> {
    const existingPart = await prisma.part.findFirst({
      where: {
        OR: [
          { partNumber: data.partNumber },
          ...(data.barcode ? [{ barcode: data.barcode }] : []),
          ...(data.sku ? [{ sku: data.sku }] : []),
        ],
      },
    });

    if (existingPart) {
      if (existingPart.partNumber === data.partNumber) {
        throw new ConflictError('Part number already exists');
      }
      if (data.barcode && existingPart.barcode === data.barcode) {
        throw new ConflictError('Barcode already exists');
      }
      if (data.sku && existingPart.sku === data.sku) {
        throw new ConflictError('SKU already exists');
      }
    }

    const createData: any = {
      ...data,
      price: new Prisma.Decimal(data.price),
      cost: data.cost ? new Prisma.Decimal(data.cost) : null,
      weight: data.weight ? new Prisma.Decimal(data.weight) : null,
    };

    if (userId) {
      createData.createdBy = userId;
    }

    const part = await prisma.part.create({
      data: createData,
    });

    logger.info(`Part created: ${part.partNumber}`, { userId, partId: part.id });
    return part;
  }

  async findAll(query: QueryPartsInput): Promise<{ parts: Part[]; total: number; totalPages: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PartWhereInput = {};

    if (query.search) {
      where.OR = [
        { partNumber: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { barcode: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.category) where.category = query.category;
    if (query.subcategory) where.subcategory = query.subcategory;
    if (query.manufacturer) where.manufacturer = query.manufacturer;
    if (query.status) where.status = query.status as any;

    if (query.minPrice || query.maxPrice) {
      where.price = {};
      if (query.minPrice) where.price.gte = new Prisma.Decimal(query.minPrice);
      if (query.maxPrice) where.price.lte = new Prisma.Decimal(query.maxPrice);
    }

    if (query.minQuantity !== undefined) {
      where.quantity = { gte: query.minQuantity };
    }

    if (query.tags) {
      const tags = Array.isArray(query.tags) ? query.tags : [query.tags];
      where.tags = { hasSome: tags };
    }

    const [parts, total] = await Promise.all([
      prisma.part.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        include: { creator: true },
      }),
      prisma.part.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return { parts, total, totalPages };
  }

  async findById(id: string): Promise<Part> {
    const part = await prisma.part.findUnique({
      where: { id },
      include: { 
        creator: true,
        inventoryLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!part) {
      throw new NotFoundError('Part not found');
    }

    return part;
  }

  async findByPartNumber(partNumber: string): Promise<Part> {
    const part = await prisma.part.findUnique({
      where: { partNumber },
      include: { 
        creator: true,
        inventoryLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!part) {
      throw new NotFoundError('Part not found');
    }

    return part;
  }

  async update(id: string, data: UpdatePartInput): Promise<Part> {
    const existingPart = await prisma.part.findUnique({
      where: { id },
    });

    if (!existingPart) {
      throw new NotFoundError('Part not found');
    }

    if (data.partNumber || data.barcode || data.sku) {
      const conflictPart = await prisma.part.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(data.partNumber ? [{ partNumber: data.partNumber }] : []),
                ...(data.barcode ? [{ barcode: data.barcode }] : []),
                ...(data.sku ? [{ sku: data.sku }] : []),
              ],
            },
          ],
        },
      });

      if (conflictPart) {
        if (data.partNumber && conflictPart.partNumber === data.partNumber) {
          throw new ConflictError('Part number already exists');
        }
        if (data.barcode && conflictPart.barcode === data.barcode) {
          throw new ConflictError('Barcode already exists');
        }
        if (data.sku && conflictPart.sku === data.sku) {
          throw new ConflictError('SKU already exists');
        }
      }
    }

    const updateData: any = { ...data };
    if (data.price !== undefined) updateData.price = new Prisma.Decimal(data.price);
    if (data.cost !== undefined) updateData.cost = new Prisma.Decimal(data.cost);
    if (data.weight !== undefined) updateData.weight = new Prisma.Decimal(data.weight);

    const part = await prisma.part.update({
      where: { id },
      data: updateData,
    });

    logger.info(`Part updated: ${part.partNumber}`, { partId: part.id });
    return part;
  }

  async delete(id: string): Promise<void> {
    const part = await prisma.part.findUnique({
      where: { id },
    });

    if (!part) {
      throw new NotFoundError('Part not found');
    }

    await prisma.part.delete({
      where: { id },
    });

    logger.info(`Part deleted: ${part.partNumber}`, { partId: part.id });
  }

  async updateInventory(id: string, data: InventoryUpdateInput, userId?: string): Promise<Part> {
    const part = await prisma.part.findUnique({
      where: { id },
    });

    if (!part) {
      throw new NotFoundError('Part not found');
    }

    let newQuantity: number;

    switch (data.type) {
      case 'ADD':
        newQuantity = part.quantity + Math.abs(data.quantity);
        break;
      case 'REMOVE':
        newQuantity = part.quantity - Math.abs(data.quantity);
        if (newQuantity < 0) {
          throw new ValidationError('Insufficient quantity');
        }
        break;
      case 'ADJUST':
        newQuantity = data.quantity;
        break;
      default:
        newQuantity = part.quantity - Math.abs(data.quantity);
        if (newQuantity < 0) {
          throw new ValidationError('Insufficient quantity');
        }
    }

    const [updatedPart] = await prisma.$transaction([
      prisma.part.update({
        where: { id },
        data: { 
          quantity: newQuantity,
          status: newQuantity === 0 ? 'OUT_OF_STOCK' : part.status,
        },
      }),
      prisma.inventoryLog.create({
        data: {
          partId: id,
          type: data.type,
          quantity: data.quantity,
          previousQty: part.quantity,
          newQty: newQuantity,
          reference: data.reference,
          notes: data.notes,
          performedBy: userId,
        },
      }),
    ]);

    logger.info(`Inventory updated for part: ${part.partNumber}`, {
      partId: part.id,
      type: data.type,
      quantity: data.quantity,
      newQuantity,
    });

    return updatedPart;
  }

  async getCategories(): Promise<string[]> {
    const categories = await prisma.part.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    return categories.map(c => c.category);
  }

  async getManufacturers(): Promise<(string | null)[]> {
    const manufacturers = await prisma.part.findMany({
      select: { manufacturer: true },
      distinct: ['manufacturer'],
      where: { manufacturer: { not: null } },
      orderBy: { manufacturer: 'asc' },
    });

    return manufacturers.map(m => m.manufacturer);
  }
}

export const partService = new PartService();