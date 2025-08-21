import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { config } from './config/env';
import routes from './routes';
import { healthController } from './controllers/health.controller';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { correlationMiddleware } from './middleware/correlation.middleware';
import { loggingMiddleware } from './middleware/logging.middleware';
import { apiLimiter, authLimiter } from './middleware/rateLimit.middleware';
import { logger } from './utils/logger';

export const createApp = (): Application => {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: config.env === 'production',
  }));

  // CORS
  app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', config.apiKey.header],
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Request correlation
  app.use(correlationMiddleware);

  // Logging
  if (config.env !== 'test') {
    app.use(morgan('dev'));
    app.use(loggingMiddleware);
  }

  // Rate limiting
  app.use('/api/', apiLimiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);

  // Health and metrics endpoints
  app.get('/health', healthController.health);
  app.get('/metrics', healthController.metrics);

  // API Documentation
  if (config.swagger.enabled) {
    const swaggerDocument = require('../swagger.json');
    app.use(config.swagger.path, swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Parts API Documentation',
    }));
  }

  // API routes
  app.use(`/api/${config.apiVersion}`, routes);
  app.use('/api', routes); // Support without version

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
};

export default createApp;