import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config/env';
import { AuthenticationError, ConflictError, ValidationError } from '../errors/AppError';
import { JwtPayload } from '../types/express';
import { logger } from '../utils/logger';

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginInput {
  email?: string;
  username?: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: Partial<User>;
}

export class AuthService {
  async register(data: RegisterInput): Promise<TokenResponse> {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictError(
        existingUser.email === data.email 
          ? 'Email already exists' 
          : 'Username already exists'
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, config.security.bcryptRounds);

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });

    return this.generateTokens(user);
  }

  async login(data: LoginInput): Promise<TokenResponse> {
    if (!data.email && !data.username) {
      throw new ValidationError('Email or username is required');
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email },
          { username: data.username },
        ],
        isActive: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: payload.id },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new AuthenticationError('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      logger.error('Refresh token error:', error);
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch (error) {
      throw new AuthenticationError('Invalid token');
    }
  }

  async verifyApiKey(apiKey: string): Promise<User | null> {
    if (apiKey === config.apiKey.masterKey) {
      return prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });
    }

    const user = await prisma.user.findUnique({
      where: { apiKey },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  private async generateTokens(user: User): Promise<TokenResponse> {
    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    const { password, refreshToken: _, apiKey, ...userWithoutSensitive } = user;

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
      user: userWithoutSensitive,
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid old password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);

    await prisma.user.update({
      where: { id: userId },
      data: { 
        password: hashedPassword,
        refreshToken: null,
      },
    });
  }

  async generateApiKey(userId: string): Promise<string> {
    const apiKey = `pk_${Buffer.from(Math.random().toString()).toString('base64').replace(/[/+=]/g, '')}`;
    
    await prisma.user.update({
      where: { id: userId },
      data: { apiKey },
    });

    return apiKey;
  }
}

export const authService = new AuthService();