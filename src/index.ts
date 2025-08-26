import 'dotenv/config';
import createApp from './app';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { logger } from './utils/logger';
import { VoiceWebSocketHandler } from './websocket/voice.handler';

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Create Express app
    const app = createApp();

    // Initialize WebSocket handler for voice
    const voiceHandler = new VoiceWebSocketHandler();
    (app as any).voiceHandler = voiceHandler;

    // Start server
    const server = app.listen(config.port, () => {
      logger.info(`🚀 ${config.appName} ${config.apiVersion} is running on port ${config.port}`);
      logger.info(`📚 API Documentation: http://localhost:${config.port}${config.swagger.path}`);
      logger.info(`🏥 Health check: http://localhost:${config.port}/health`);
      logger.info(`📊 Metrics: http://localhost:${config.port}/metrics`);
      logger.info(`🎙️ Voice WebSocket: ws://localhost:${config.port}/api/v1/voice/realtime`);
      logger.info(`🌍 Environment: ${config.env}`);

      if (!config.openai.apiKey) {
        logger.warn('⚠️  OpenAI API key not configured - voice features will not work');
      }
    });

    // Handle WebSocket upgrade for voice endpoint
    server.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;

      if (pathname === '/api/v1/voice/realtime' || pathname === '/api/voice/realtime') {
        voiceHandler.handleUpgrade(request, socket, head);
      } else {
        socket.destroy();
      }
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        await disconnectDatabase();

        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
