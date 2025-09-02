import { Request, Response, NextFunction } from 'express';
import { generateWebSocketToken } from '../middleware/websocket-auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { config } from '../config/env';

class VoiceController {
  /**
   * Get WebSocket connection token for voice endpoint
   */
  getConnectionToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // In production, you'd get userId from authenticated session
      // For now, we'll use a dummy user ID or from request
      const userId = (req as any).user?.id || 'demo-user';

      const token = generateWebSocketToken(userId);
      // Check for forwarded protocol (Railway uses this)
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
      const wsUrl = `${wsProtocol}://${req.get('host')}/api/v1/voice/realtime`;

      res.json({
        success: true,
        data: {
          token,
          url: wsUrl,
          expiresIn: 3600, // 1 hour
          model: 'gpt-realtime',
          supportedFormats: ['pcm16', 'g711_ulaw', 'g711_alaw'],
          defaultFormat: 'pcm16',
          sampleRate: 24000,
          instructions:
            'Connect to the WebSocket endpoint with the provided token. You have access to internet search, weather, news, stock prices, and current time through function calls.',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get voice session history for a user
   */
  getSessionHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id || 'demo-user';
      const { limit = 10, offset = 0, status } = req.query;

      const where: any = { userId };
      if (status) {
        where.status = status as string;
      }

      const [sessions, total] = await Promise.all([
        prisma.voiceSession.findMany({
          where,
          take: Number(limit),
          skip: Number(offset),
          orderBy: { startTime: 'desc' },
        }),
        prisma.voiceSession.count({ where }),
      ]);

      const sessionsWithMetrics = sessions.map((session: any) => {
        const duration = session.endTime
          ? Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000)
          : null;

        const estimatedCost = this.calculateSessionCost(session);

        return {
          ...session,
          duration,
          estimatedCost,
        };
      });

      res.json({
        success: true,
        data: {
          sessions: sessionsWithMetrics,
          pagination: {
            total,
            limit: Number(limit),
            offset: Number(offset),
            hasMore: Number(offset) + Number(limit) < total,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get specific voice session details
   */
  getSessionDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user?.id || 'demo-user';

      const session = await prisma.voiceSession.findFirst({
        where: {
          id: sessionId,
          userId,
        },
      });

      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found',
        });
        return;
      }

      // Get conversation history if stored
      const conversations = await prisma.voiceConversation.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
      });

      const duration = session.endTime
        ? Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000)
        : null;

      const estimatedCost = this.calculateSessionCost(session);

      res.json({
        success: true,
        data: {
          session: {
            ...session,
            duration,
            estimatedCost,
          },
          conversations,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get usage statistics
   */
  getUsageStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id || 'demo-user';
      const { period = '7d' } = req.query;

      const startDate = this.getStartDateFromPeriod(period as string);

      const stats = await prisma.voiceSession.aggregate({
        where: {
          userId,
          startTime: {
            gte: startDate,
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          inputAudioTokens: true,
          outputAudioTokens: true,
        },
      });

      const sessions = await prisma.voiceSession.findMany({
        where: {
          userId,
          startTime: {
            gte: startDate,
          },
          endTime: {
            not: null,
          },
        },
      });

      const totalDuration = sessions.reduce((sum: number, session: any) => {
        if (session.endTime) {
          return sum + (session.endTime.getTime() - session.startTime.getTime());
        }
        return sum;
      }, 0);

      const totalCost = sessions.reduce((sum: number, session: any) => {
        return sum + this.calculateSessionCost(session);
      }, 0);

      res.json({
        success: true,
        data: {
          period,
          startDate,
          sessions: stats._count.id,
          totalDurationSeconds: Math.floor(totalDuration / 1000),
          totalDurationMinutes: Math.floor(totalDuration / 60000),
          tokens: {
            input: stats._sum.inputTokens || 0,
            output: stats._sum.outputTokens || 0,
            inputAudio: stats._sum.inputAudioTokens || 0,
            outputAudio: stats._sum.outputAudioTokens || 0,
          },
          estimatedCost: {
            total: totalCost,
            breakdown: {
              textInput: ((stats._sum.inputTokens || 0) / 1000000) * 5,
              textOutput: ((stats._sum.outputTokens || 0) / 1000000) * 20,
              audioInput: ((stats._sum.inputAudioTokens || 0) / 1000000) * 100,
              audioOutput: ((stats._sum.outputAudioTokens || 0) / 1000000) * 200,
            },
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Health check for voice service
   */
  healthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const voiceHandler = (req.app as any).voiceHandler;
      const activeSessions = voiceHandler?.getActiveSessions() || 0;

      const openaiConfigured = !!config.openai?.apiKey;

      res.json({
        success: true,
        data: {
          status: openaiConfigured ? 'healthy' : 'missing_configuration',
          activeSessions,
          openaiConfigured,
          supportedModels: ['gpt-realtime'],
          websocketEndpoint: '/api/v1/voice/realtime',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  private calculateSessionCost = (session: any): number => {
    const textInputCost = (session.inputTokens / 1000000) * 5;
    const textOutputCost = (session.outputTokens / 1000000) * 20;
    const audioInputCost = (session.inputAudioTokens / 1000000) * 100;
    const audioOutputCost = (session.outputAudioTokens / 1000000) * 200;

    return textInputCost + textOutputCost + audioInputCost + audioOutputCost;
  };

  private getStartDateFromPeriod = (period: string): Date => {
    const now = new Date();
    switch (period) {
      case '1d':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  };
}

export const voiceController = new VoiceController();
