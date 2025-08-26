import { Request, Response, NextFunction } from 'express';
import { EmailService } from '../services/email.service';
import { config } from '../config/env';
import { logger } from '../utils/logger';

class EmailController {
  private emailService: EmailService | null = null;

  constructor() {
    this.initializeEmailService();
  }

  private async initializeEmailService(): Promise<void> {
    logger.info('Starting email service initialization', {
      hasUser: !!config.email.user,
      hasPass: !!config.email.pass,
      user: config.email.user,
      smtpHost: config.email.smtp.host,
      smtpPort: config.email.smtp.port,
    });

    if (!config.email.user || !config.email.pass) {
      logger.warn('Email service not configured - missing credentials', {
        user: config.email.user,
        passLength: config.email.pass?.length || 0,
      });
      return;
    }

    try {
      logger.info('Creating email service instance...');

      this.emailService = new EmailService({
        smtp: {
          host: config.email.smtp.host,
          port: config.email.smtp.port,
          user: config.email.user,
          pass: config.email.pass,
          from: config.email.from,
        },
        imap: {
          host: config.email.imap.host,
          port: config.email.imap.port,
          user: config.email.user,
          pass: config.email.pass,
        },
      });

      logger.info('Initializing email service...');
      await this.emailService.initialize();
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.emailService = null;
    }
  }

  /**
   * Send an email
   */
  sendEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.emailService?.isServiceReady()) {
        res.status(503).json({
          success: false,
          error: 'Email service not configured or not ready',
        });
        return;
      }

      const { to, subject, text, html } = req.body;

      if (!to || !subject || !text) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: to, subject, text',
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        res.status(400).json({
          success: false,
          error: 'Invalid email address format',
        });
        return;
      }

      const result = await this.emailService.sendEmail(to, subject, text, html);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            messageId: result.messageId,
            response: result.response,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error('Email send error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };

  /**
   * Get inbox emails (cached)
   */
  getInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.emailService?.isServiceReady()) {
        res.status(503).json({
          success: false,
          error: 'Email service not configured or not ready',
        });
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50); // Max 50 emails
      const emails = await this.emailService.getInbox(limit);

      res.status(200).json({
        success: true,
        data: {
          emails,
          count: emails.length,
          limit,
        },
      });
    } catch (error) {
      logger.error('Email inbox error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };

  /**
   * Refresh inbox (force fetch)
   */
  refreshInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.emailService?.isServiceReady()) {
        res.status(503).json({
          success: false,
          error: 'Email service not configured or not ready',
        });
        return;
      }

      const emails = await this.emailService.refreshInbox();

      res.status(200).json({
        success: true,
        data: {
          emails,
          count: emails.length,
          refreshed: true,
        },
      });
    } catch (error) {
      logger.error('Email refresh error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };

  /**
   * Get email service health status
   */
  getHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const isReady = this.emailService?.isServiceReady() || false;

      res.status(200).json({
        success: true,
        data: {
          status: isReady ? 'healthy' : 'unavailable',
          configured: !!this.emailService,
          ready: isReady,
          config: {
            smtpHost: config.email.smtp.host,
            smtpPort: config.email.smtp.port,
            imapHost: config.email.imap.host,
            imapPort: config.email.imap.port,
            fromEmail: config.email.from,
            hasUser: !!config.email.user,
            hasPass: !!config.email.pass,
            userLength: config.email.user?.length || 0,
            passLength: config.email.pass?.length || 0,
          },
          diagnostics: {
            serviceInstance: !!this.emailService,
            initializationAttempted: true,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      logger.error('Email health check error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };
}

export const emailController = new EmailController();
