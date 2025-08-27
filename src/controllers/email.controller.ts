import { Request, Response, NextFunction } from 'express';
import { EmailService, EmailConfig } from '../services/email.service';
import { config } from '../config/env';

import { logger } from '../utils/logger';

interface EmailControllerResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

class EmailController {
  private emailService: EmailService | null = null;

  constructor() {
    this.initializeEmailService();
  }

  // Helper function to clean Railway environment variables
  private cleanEnvVar(value?: string): string | undefined {
    if (!value) return value;
    return value.replace(/^["']|["']$/g, '');
  }

  private async initializeEmailService(): Promise<void> {
    try {
      const emailUser = this.cleanEnvVar(config.email.user);
      const emailPass = this.cleanEnvVar(config.email.pass);

      if (!emailUser || !emailPass) {
        logger.warn('Email service not configured - missing EMAIL_USER or EMAIL_PASS');
        return;
      }

      logger.info('Initializing email service', {
        user: emailUser,
        userLength: emailUser.length,
        passLength: emailPass.length,
        smtpHost: config.email.smtp.host,
        smtpPort: config.email.smtp.port,
      });

      const emailConfig: EmailConfig = {
        smtp: {
          host: this.cleanEnvVar(config.email.smtp.host) || 'smtp.gmail.com',
          port: config.email.smtp.port || 587,
          user: emailUser,
          pass: emailPass,
          from: this.cleanEnvVar(config.email.from) || emailUser,
        },
        imap: {
          host: this.cleanEnvVar(config.email.imap.host) || 'imap.gmail.com',
          port: config.email.imap.port || 993,
          tls: true,
          user: emailUser,
          pass: emailPass,
        },
      };

      this.emailService = new EmailService(emailConfig);

      // Non-blocking initialization - critical for Railway deployment
      this.emailService.initialize().catch((err) => {
        logger.error('Email service initialization failed:', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        logger.warn('Email service will continue with degraded functionality');
        // Don't set emailService to null - allow degraded functionality
      });

      logger.info('✅ Email service construction completed');
    } catch (error) {
      logger.error('Email service constructor error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Send an email with comprehensive error handling
   */
  sendEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    try {
      logger.info('📧 Email send request received:', {
        body: req.body,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Service availability check
      if (!this.emailService) {
        const response: EmailControllerResponse = {
          success: false,
          error: 'Email service not configured - missing credentials',
        };
        logger.error('❌ Email service unavailable');
        res.status(503).json(response);
        return;
      }

      // Service readiness check
      if (!this.emailService.isServiceReady()) {
        const response: EmailControllerResponse = {
          success: false,
          error: 'Email service not ready - still initializing',
        };
        logger.warn('⚠️ Email service not ready');
        res.status(503).json(response);
        return;
      }

      // Input validation
      const { to, subject, text, html } = req.body;

      if (!to || !subject || !text) {
        const response: EmailControllerResponse = {
          success: false,
          error: 'Missing required fields: to, subject, text',
        };
        logger.warn('❌ Missing required fields');
        res.status(400).json(response);
        return;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        const response: EmailControllerResponse = {
          success: false,
          error: 'Invalid email address format',
        };
        logger.warn('❌ Invalid email format:', to);
        res.status(400).json(response);
        return;
      }

      // Test endpoint for quick verification
      if (req.path.includes('/test')) {
        const response: EmailControllerResponse = {
          success: true,
          message: 'Controller reached successfully - email service ready',
          data: {
            serviceStatus: this.emailService.getServiceStatus(),
            requestProcessingTime: Date.now() - startTime,
          },
        };
        logger.info('✅ Test endpoint response');
        res.status(200).json(response);
        return;
      }

      // Send the email
      logger.info('🚀 Calling email service sendEmail...', { to, subject });
      const result = await this.emailService.sendEmail(to, subject, text, html);

      const processingTime = Date.now() - startTime;
      logger.info('📬 Email service returned:', {
        ...result,
        processingTime: `${processingTime}ms`,
      });

      if (result.success) {
        const response: EmailControllerResponse = {
          success: true,
          data: {
            messageId: result.messageId,
            response: result.response,
            processingTime,
          },
          message: 'Email sent successfully',
        };
        logger.info('✅ Email sent successfully');
        res.status(200).json(response);
      } else {
        const response: EmailControllerResponse = {
          success: false,
          error: result.error,
          data: {
            processingTime,
          },
        };
        logger.error('❌ Email send failed:', result.error);
        res.status(500).json(response);
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('💥 Email send controller error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime,
      });

      const response: EmailControllerResponse = {
        success: false,
        error: 'Internal server error during email send',
        data: {
          processingTime,
        },
      };
      res.status(500).json(response);
    }
  };

  /**
   * Get inbox emails (cached) with comprehensive error handling
   */
  getInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.emailService) {
        const response: EmailControllerResponse = {
          success: false,
          error: 'Email service not configured',
        };
        res.status(503).json(response);
        return;
      }

      if (!this.emailService.isServiceReady()) {
        const response: EmailControllerResponse = {
          success: false,
          error: 'Email service not ready',
        };
        res.status(503).json(response);
        return;
      }

      // Validate and sanitize limit parameter
      const rawLimit = req.query.limit as string;
      const limit = Math.min(Math.max(parseInt(rawLimit) || 10, 1), 100); // Between 1 and 100

      logger.info('📥 Getting inbox emails', { limit });

      const emails = await this.emailService.getInbox(limit);

      const response: EmailControllerResponse = {
        success: true,
        data: {
          emails,
          count: emails.length,
          limit,
          cached: true,
        },
        message: `Retrieved ${emails.length} emails`,
      };

      logger.info('✅ Inbox retrieved successfully', { count: emails.length, limit });
      res.status(200).json(response);
    } catch (error) {
      logger.error('Email inbox controller error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const response: EmailControllerResponse = {
        success: false,
        error: 'Failed to retrieve inbox',
      };
      res.status(500).json(response);
    }
  };

  /**
   * Refresh inbox (force fetch) with comprehensive error handling
   */
  refreshInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    try {
      if (!this.emailService) {
        const response: EmailControllerResponse = {
          success: false,
          error: 'Email service not configured',
        };
        res.status(503).json(response);
        return;
      }

      if (!this.emailService.isServiceReady()) {
        const response: EmailControllerResponse = {
          success: false,
          error: 'Email service not ready',
        };
        res.status(503).json(response);
        return;
      }

      logger.info('🔄 Refreshing inbox (force fetch)');

      const emails = await this.emailService.refreshInbox();
      const processingTime = Date.now() - startTime;

      const response: EmailControllerResponse = {
        success: true,
        data: {
          emails,
          count: emails.length,
          refreshed: true,
          processingTime,
        },
        message: `Refreshed inbox with ${emails.length} emails`,
      };

      logger.info('✅ Inbox refreshed successfully', {
        count: emails.length,
        processingTime: `${processingTime}ms`,
      });
      res.status(200).json(response);
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Email refresh controller error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      });

      const response: EmailControllerResponse = {
        success: false,
        error: 'Failed to refresh inbox',
        data: {
          processingTime,
        },
      };
      res.status(500).json(response);
    }
  };

  /**
   * Get email service health status with detailed diagnostics
   */
  getHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const serviceStatus = this.emailService?.getServiceStatus();
      const isReady = this.emailService?.isServiceReady() || false;
      const isConfigured = !!this.emailService;

      // Determine overall status
      let status: 'healthy' | 'degraded' | 'disabled';
      if (isConfigured && isReady) {
        status = 'healthy';
      } else if (isConfigured) {
        status = 'degraded';
      } else {
        status = 'disabled';
      }

      const response: EmailControllerResponse = {
        success: true,
        data: {
          status,
          configured: isConfigured,
          ready: isReady,
          service: isConfigured ? 'active' : 'disabled',
          details: serviceStatus || {
            initialized: false,
            transporterReady: false,
            imapReady: false,
            cachedEmailCount: 0,
          },
          timestamp: new Date().toISOString(),
          environment: {
            hasEmailUser: !!config.email.user,
            hasEmailPass: !!config.email.pass,
            smtpHost: config.email.smtp.host,
            smtpPort: config.email.smtp.port,
            imapHost: config.email.imap.host,
            imapPort: config.email.imap.port,
          },
        },
        message: `Email service is ${status}`,
      };

      logger.info('🏥 Health check completed', { status, isConfigured, isReady });
      res.status(200).json(response);
    } catch (error) {
      logger.error('Email health check controller error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const response: EmailControllerResponse = {
        success: false,
        error: 'Health check failed',
        data: {
          status: 'error',
          timestamp: new Date().toISOString(),
        },
      };
      res.status(500).json(response);
    }
  };

  /**
   * Manual retry initialization endpoint for debugging
   */
  retryInit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      logger.info('🔄 Manual email service initialization retry requested');

      if (!this.emailService) {
        // Try to reinitialize the service
        await this.initializeEmailService();
      }

      if (this.emailService) {
        // Force re-initialization
        await this.emailService.initialize();

        const response: EmailControllerResponse = {
          success: true,
          data: {
            status: 'reinitialized',
            ready: this.emailService.isServiceReady(),
            serviceStatus: this.emailService.getServiceStatus(),
          },
          message: 'Email service reinitialized successfully',
        };

        logger.info('✅ Email service reinitialized');
        res.status(200).json(response);
      } else {
        const response: EmailControllerResponse = {
          success: false,
          error: 'Failed to create email service - check configuration',
        };
        res.status(503).json(response);
      }
    } catch (error) {
      logger.error('Email service retry initialization error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const response: EmailControllerResponse = {
        success: false,
        error: 'Retry initialization failed',
      };
      res.status(500).json(response);
    }
  };
}

export const emailController = new EmailController();
