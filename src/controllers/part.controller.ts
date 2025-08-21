import { Request, Response, NextFunction } from 'express';
import { partService } from '../services/part.service';
import { ApiResponse } from '../types/express';
import { ValidationError } from '../errors/AppError';
import {
  createPartSchema,
  updatePartSchema,
  queryPartsSchema,
  inventoryUpdateSchema,
} from '../validators/part.validator';

export class PartController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = createPartSchema.validate(req.body);
      if (error) {
        return next(new ValidationError(error.details[0].message));
      }

      const part = await partService.create(value, req.user?.id);

      const response: ApiResponse = {
        success: true,
        data: part,
        message: 'Part created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = queryPartsSchema.validate(req.query);
      if (error) {
        return next(new ValidationError(error.details[0].message));
      }

      const result = await partService.findAll(value);

      const response: ApiResponse = {
        success: true,
        data: result.parts,
        metadata: {
          page: value.page || 1,
          limit: value.limit || 20,
          total: result.total,
          totalPages: result.totalPages,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const part = await partService.findById(req.params.id);

      const response: ApiResponse = {
        success: true,
        data: part,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = updatePartSchema.validate(req.body);
      if (error) {
        return next(new ValidationError(error.details[0].message));
      }

      const part = await partService.update(req.params.id, value);

      const response: ApiResponse = {
        success: true,
        data: part,
        message: 'Part updated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await partService.delete(req.params.id);

      const response: ApiResponse = {
        success: true,
        message: 'Part deleted successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async updateInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = inventoryUpdateSchema.validate(req.body);
      if (error) {
        return next(new ValidationError(error.details[0].message));
      }

      const part = await partService.updateInventory(
        req.params.id,
        value,
        req.user?.id
      );

      const response: ApiResponse = {
        success: true,
        data: part,
        message: 'Inventory updated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await partService.getCategories();

      const response: ApiResponse = {
        success: true,
        data: categories,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async getManufacturers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const manufacturers = await partService.getManufacturers();

      const response: ApiResponse = {
        success: true,
        data: manufacturers,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const partController = new PartController();