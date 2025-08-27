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
    // Helper function to clean Railway environment variables
    const cleanEnvVar = (value?: string): string | undefined => {
      if (!value) return value;
      return value.replace(/^["']|["']$/g, '');
    };

    const emailUser = cleanEnvVar(config.email.user);
    const emailPass = cleanEnvVar(config.email.pass);

    if (emailUser && emailPass) {
      logger.info('Initializing email service for:', emailUser);

      this.emailService = new EmailService({
        smtp: {
          host: cleanEnvVar(config.email.smtp.host) || 'smtp.gmail.com',
          port: config.email.smtp.port || 587,
          user: emailUser,
          pass: emailPass,
          from: cleanEnvVar(config.email.from) || emailUser,
        },
        imap: {
          host: cleanEnvVar(config.email.imap.host) || 'imap.gmail.com',
          port: config.email.imap.port || 993,
          tls: true,
          user: emailUser,
          pass: emailPass,
        },
      });

      // Non-blocking initialization
      this.emailService.initialize().catch((err) => {
        logger.error('Failed to initialize email service:', err);
        logger.error('Email service will continue but may have issues');
        // Don't set emailService to null - allow degraded functionality
      });
    } else {
      logger.warn('Email service not configured - missing credentials');
    }
  }

  /**
   * Send an email
   */
  sendEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    logger.info('Email send request received:', req.body);

    if (!this.emailService) {
      logger.error('Email service not configured');
      res.status(503).json({
        success: false,
        error: 'Email service not configured',
      });
      return;
    }

    try {
      const { to, subject, text, html } = req.body;
      logger.info('Processing email send for:', { to, subject });

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

      logger.info('Calling email service sendEmail...');
      const result = await this.emailService.sendEmail(to, subject, text, html);
      logger.info('Email service returned:', result);

      if (result.success) {
        logger.info('Email sent successfully, sending success response');
        res.status(200).json({
          success: true,
          data: {
            messageId: result.messageId,
            response: result.response,
          },
        });
      } else {
        logger.error('Email send failed, sending error response:', result.error);
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error) {
      logger.error('Email send error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };

  /**
   * Get inbox emails (cached)
   */
  getInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!this.emailService) {
      res.status(503).json({
        success: false,
        error: 'Email service not configured',
      });
      return;
    }

    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
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
      logger.error('Email inbox error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };

  /**
   * Refresh inbox (force fetch)
   */
  refreshInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!this.emailService) {
      res.status(503).json({
        success: false,
        error: 'Email service not configured',
      });
      return;
    }

    try {
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
      logger.error('Email refresh error:', {
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
          status: isReady ? 'healthy' : 'disabled',
          configured: !!this.emailService,
          ready: isReady,
          service: this.emailService ? 'active' : 'disabled',
        },
      });
    } catch (error) {
      logger.error('Email health check error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };
}

export const emailController = new EmailController();
