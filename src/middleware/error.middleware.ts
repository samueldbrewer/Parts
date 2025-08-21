import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';
import { ApiResponse } from '../types/express';
import { config } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    return next(err);
  }

  let error = err;
  
  if (!(error instanceof AppError)) {
    const message = config.env === 'production' 
      ? 'Internal server error' 
      : error.message || 'Internal server error';
    error = new AppError(message, 500, 'INTERNAL_ERROR', false);
  }

  const appError = error as AppError;

  if (!appError.isOperational) {
    logger.error('Unexpected error:', {
      error: err,
      stack: err.stack,
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        params: req.params,
        query: req.query,
      },
    });
  }

  const response: ApiResponse = {
    success: false,
    error: appError.message,
    ...(config.env !== 'production' && { 
      stack: err.stack,
      code: appError.code,
    }),
  };

  res.status(appError.statusCode).json(response);
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const response: ApiResponse = {
    success: false,
    error: `Cannot ${req.method} ${req.path}`,
  };

  res.status(404).json(response);
};