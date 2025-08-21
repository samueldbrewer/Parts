import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { ValidationError } from '../errors/AppError';

export const validate = (schema: Schema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req[property]);
    
    if (error) {
      const message = error.details.map(d => d.message).join(', ');
      return next(new ValidationError(message));
    }
    
    next();
  };
};