import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../types/express';
import { ValidationError, AuthenticationError } from '../errors/AppError';
import { 
  registerSchema, 
  loginSchema, 
  refreshTokenSchema, 
  changePasswordSchema 
} from '../validators/auth.validator';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return next(new ValidationError(error.details[0].message));
      }

      const result = await authService.register(value);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Registration successful',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return next(new ValidationError(error.details[0].message));
      }

      const result = await authService.login(value);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Login successful',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = refreshTokenSchema.validate(req.body);
      if (error) {
        return next(new ValidationError(error.details[0].message));
      }

      const result = await authService.refreshToken(value.refreshToken);

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Token refreshed successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new AuthenticationError());
      }

      await authService.logout(req.user.id);

      const response: ApiResponse = {
        success: true,
        message: 'Logout successful',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new AuthenticationError());
      }

      const { password, refreshToken, apiKey, ...user } = req.user;

      const response: ApiResponse = {
        success: true,
        data: user,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new AuthenticationError());
      }

      const { error, value } = changePasswordSchema.validate(req.body);
      if (error) {
        return next(new ValidationError(error.details[0].message));
      }

      await authService.changePassword(req.user.id, value.oldPassword, value.newPassword);

      const response: ApiResponse = {
        success: true,
        message: 'Password changed successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  async generateApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next(new AuthenticationError());
      }

      const apiKey = await authService.generateApiKey(req.user.id);

      const response: ApiResponse = {
        success: true,
        data: { apiKey },
        message: 'API key generated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();