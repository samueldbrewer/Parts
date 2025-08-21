import { User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      correlationId?: string;
      apiKey?: string;
    }
  }
}

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  metadata?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}