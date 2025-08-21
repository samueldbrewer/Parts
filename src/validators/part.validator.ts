import Joi from 'joi';
import { PartStatus } from '@prisma/client';

export const createPartSchema = Joi.object({
  partNumber: Joi.string().required().trim().max(100),
  name: Joi.string().required().trim().max(255),
  description: Joi.string().optional().trim().max(1000),
  manufacturer: Joi.string().optional().trim().max(255),
  category: Joi.string().required().trim().max(100),
  subcategory: Joi.string().optional().trim().max(100),
  price: Joi.number().positive().required(),
  cost: Joi.number().positive().optional(),
  quantity: Joi.number().integer().min(0).default(0),
  minQuantity: Joi.number().integer().min(0).default(0),
  location: Joi.string().optional().trim().max(255),
  barcode: Joi.string().optional().trim().max(100),
  sku: Joi.string().optional().trim().max(100),
  weight: Joi.number().positive().optional(),
  dimensions: Joi.object({
    length: Joi.number().positive().optional(),
    width: Joi.number().positive().optional(),
    height: Joi.number().positive().optional(),
    unit: Joi.string().valid('mm', 'cm', 'm', 'in', 'ft').optional(),
  }).optional(),
  specifications: Joi.object().optional(),
  images: Joi.array().items(Joi.string().uri()).default([]),
  tags: Joi.array().items(Joi.string().trim().max(50)).default([]),
  status: Joi.string().valid(...Object.values(PartStatus)).default(PartStatus.ACTIVE),
});

export const updatePartSchema = Joi.object({
  partNumber: Joi.string().trim().max(100),
  name: Joi.string().trim().max(255),
  description: Joi.string().trim().max(1000).allow(null),
  manufacturer: Joi.string().trim().max(255).allow(null),
  category: Joi.string().trim().max(100),
  subcategory: Joi.string().trim().max(100).allow(null),
  price: Joi.number().positive(),
  cost: Joi.number().positive().allow(null),
  quantity: Joi.number().integer().min(0),
  minQuantity: Joi.number().integer().min(0),
  location: Joi.string().trim().max(255).allow(null),
  barcode: Joi.string().trim().max(100).allow(null),
  sku: Joi.string().trim().max(100).allow(null),
  weight: Joi.number().positive().allow(null),
  dimensions: Joi.object({
    length: Joi.number().positive().optional(),
    width: Joi.number().positive().optional(),
    height: Joi.number().positive().optional(),
    unit: Joi.string().valid('mm', 'cm', 'm', 'in', 'ft').optional(),
  }).allow(null),
  specifications: Joi.object().allow(null),
  images: Joi.array().items(Joi.string().uri()),
  tags: Joi.array().items(Joi.string().trim().max(50)),
  status: Joi.string().valid(...Object.values(PartStatus)),
}).min(1);

export const queryPartsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('name', 'partNumber', 'price', 'quantity', 'createdAt', 'updatedAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().trim().max(255),
  category: Joi.string().trim().max(100),
  subcategory: Joi.string().trim().max(100),
  manufacturer: Joi.string().trim().max(255),
  status: Joi.string().valid(...Object.values(PartStatus)),
  minPrice: Joi.number().positive(),
  maxPrice: Joi.number().positive(),
  minQuantity: Joi.number().integer().min(0),
  tags: Joi.alternatives().try(
    Joi.string().trim(),
    Joi.array().items(Joi.string().trim())
  ),
});

export const inventoryUpdateSchema = Joi.object({
  type: Joi.string().valid('ADD', 'REMOVE', 'ADJUST', 'TRANSFER', 'RETURN', 'DAMAGE', 'LOSS').required(),
  quantity: Joi.number().integer().required(),
  reference: Joi.string().trim().max(255),
  notes: Joi.string().trim().max(1000),
});