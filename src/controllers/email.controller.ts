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
      logger.info('🚀 Initializing email service v2 for:', emailUser);

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
        logger.error('❌ Failed to initialize email service:', err);
        logger.warn('⚠️ Email service will continue but may have degraded functionality');
        // Don't set emailService to null - allow degraded functionality
      });
    } else {
      logger.warn('⚠️ Email service not configured - missing credentials');
    }
  }

  /**
   * Send an email with enhanced error handling
   */
  sendEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    if (!this.emailService) {
      return res.status(503).json({
        success: false,
        error: 'Email service not configured',
        message: 'Missing EMAIL_USER or EMAIL_PASS environment variables',
      });
    }

    try {
      const { to, subject, text, html } = req.body;

      // Enhanced validation
      if (!to || !subject || !text) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: to, subject, text',
          provided: { to: !!to, subject: !!subject, text: !!text },
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email address format',
          provided: to,
        });
      }

      // Send email with timing
      const result = await this.emailService.sendEmail(to, subject, text, html);
      const totalTime = Date.now() - startTime;

      if (result.success) {
        return res.status(200).json({
          success: true,
          data: {
            messageId: result.messageId,
            response: result.response,
            processingTime: result.processingTime,
            totalTime,
          },
          message: 'Email sent successfully',
        });
      } else {
        return res.status(500).json({
          success: false,
          error: result.error,
          processingTime: result.processingTime,
          totalTime,
        });
      }
    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error('❌ Email controller error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        totalTime,
      });
      next(error);
    }
  };

  /**
   * Get inbox emails with enhanced response
   */
  getInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!this.emailService) {
      return res.status(503).json({
        success: false,
        error: 'Email service not configured',
      });
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
          cached: emails.length > 0,
        },
        message: `Retrieved ${emails.length} emails from inbox`,
      });
    } catch (error) {
      logger.error('❌ Email inbox controller error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };

  /**
   * Refresh inbox with enhanced response
   */
  refreshInbox = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!this.emailService) {
      return res.status(503).json({
        success: false,
        error: 'Email service not configured',
      });
    }

    try {
      const startTime = Date.now();
      const emails = await this.emailService.refreshInbox();
      const processingTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        data: {
          emails,
          count: emails.length,
          refreshed: true,
          processingTime,
        },
        message: `Refreshed inbox: ${emails.length} emails retrieved`,
      });
    } catch (error) {
      logger.error('❌ Email refresh controller error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };

  /**
   * Enhanced health check with detailed service status
   */
  getHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.emailService) {
        return res.status(200).json({
          success: true,
          data: {
            status: 'disabled',
            configured: false,
            ready: false,
            service: 'disabled',
            message: 'Email service not configured - missing credentials',
          },
        });
      }

      const isReady = this.emailService.isServiceReady();
      const serviceStatus = this.emailService.getServiceStatus();

      const healthData = {
        status: isReady ? 'healthy' : 'degraded',
        configured: true,
        ready: isReady,
        service: 'active',
        details: serviceStatus,
        environment: {
          hasUser: !!config.email.user,
          hasPass: !!config.email.pass,
          smtpHost: config.email.smtp.host,
          smtpPort: config.email.smtp.port,
          imapHost: config.email.imap.host,
          imapPort: config.email.imap.port,
        },
      };

      res.status(200).json({
        success: true,
        data: healthData,
        message: `Email service is ${healthData.status}`,
      });
    } catch (error) {
      logger.error('❌ Email health check error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };

  /**
   * Debug endpoint for detailed status
   */
  getDebugStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const serviceStatus = this.emailService?.getServiceStatus() || null;

      res.status(200).json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          service: serviceStatus,
          environment: {
            user: config.email.user,
            userLength: config.email.user?.length || 0,
            passLength: config.email.pass?.length || 0,
            from: config.email.from,
            smtpHost: config.email.smtp.host,
            smtpPort: config.email.smtp.port,
            imapHost: config.email.imap.host,
            imapPort: config.email.imap.port,
          },
          system: {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime(),
          },
        },
        message: 'Debug status retrieved successfully',
      });
    } catch (error) {
      logger.error('❌ Email debug status error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };

  /**
   * Manual retry initialization for debugging
   */
  retryInitialization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.emailService) {
        return res.status(503).json({
          success: false,
          error: 'Email service not configured',
          message: 'Cannot retry - service was never created',
        });
      }

      const success = await this.emailService.retryInitialization();
      const serviceStatus = this.emailService.getServiceStatus();

      res.status(200).json({
        success: true,
        data: {
          retrySuccessful: success,
          status: success ? 'healthy' : 'degraded',
          details: serviceStatus,
          timestamp: new Date().toISOString(),
        },
        message: success
          ? 'Email service reinitialized successfully'
          : 'Email service retry completed but may have issues',
      });
    } catch (error) {
      logger.error('❌ Email retry initialization error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      next(error);
    }
  };
}

export const emailController = new EmailController();
