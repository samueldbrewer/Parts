import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthenticationError, AuthorizationError } from '../errors/AppError';
import { config } from '../config/env';
import { Role } from '@prisma/client';
import { prisma } from '../config/database';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers[config.apiKey.header.toLowerCase()] as string;

    if (apiKey) {
      const user = await authService.verifyApiKey(apiKey);
      if (!user) {
        throw new AuthenticationError('Invalid API key');
      }
      req.user = user;
      req.apiKey = apiKey;
      return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);
    const payload = await authService.verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!roles.includes(req.user.role as Role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }

    next();
  };
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers[config.apiKey.header.toLowerCase()] as string;

    if (apiKey) {
      const user = await authService.verifyApiKey(apiKey);
      if (user) {
        req.user = user;
        req.apiKey = apiKey;
      }
      return next();
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = await authService.verifyToken(token);
        const user = await prisma.user.findUnique({
          where: { id: payload.id },
        });
        if (user && user.isActive) {
          req.user = user;
        }
      } catch {
        // Ignore token errors in optional auth
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};