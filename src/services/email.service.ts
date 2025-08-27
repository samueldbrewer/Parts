import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { logger } from '../utils/logger';

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
  };
  imap: {
    host: string;
    port: number;
    user: string;
    pass: string;
    tls: boolean;
  };
}

export interface Email {
  id: number;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  date: Date;
  attachments: number;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  response?: string;
  error?: string;
}

export class EmailService {
  private transporter!: nodemailer.Transporter;
  private imap!: Imap;
  private isInitialized = false;
  private inbox: Email[] = [];

  constructor(private config: EmailConfig) {}

  // Helper function to clean Railway environment variables
  private cleanEnvVar(value?: string): string | undefined {
    if (!value) return value;
    return value.replace(/^["']|["']$/g, '');
  }

  // CRITICAL: Non-blocking initialization for Railway deployment
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing email service with Railway-optimized configuration');

      // Clean environment variables
      const cleanUser = this.cleanEnvVar(this.config.smtp.user);
      const cleanPass = this.cleanEnvVar(this.config.smtp.pass);

      if (!cleanUser || !cleanPass) {
        throw new Error('Missing email credentials after cleaning');
      }

      // Create SMTP transporter with Railway-optimized settings
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: false,
        requireTLS: true, // CRITICAL for Gmail
        auth: {
          user: cleanUser,
          pass: cleanPass,
        },
        tls: {
          rejectUnauthorized: false, // CRITICAL for Railway
        },
        // Railway-optimized connection settings
        pool: true, // Connection pooling for efficiency
        maxConnections: 5,
        maxMessages: 100,
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000, // 10 seconds
        socketTimeout: 20000, // 20 seconds
      });

      logger.info('SMTP transporter created successfully', {
        user: cleanUser,
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        pooling: true,
      });

      // Skip SMTP verification during initialization (Railway-friendly)
      // Verification will happen on first send attempt
      logger.info('Skipping SMTP verification for Railway compatibility');

      // Initialize IMAP for inbox reading
      this.imap = new Imap({
        user: cleanUser,
        password: cleanPass,
        host: this.config.imap.host,
        port: this.config.imap.port,
        tls: this.config.imap.tls,
        tlsOptions: { rejectUnauthorized: false },
      });

      this.isInitialized = true;
      logger.info('✅ Email service initialized successfully');
    } catch (error) {
      logger.error('❌ Email service initialization failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - allow app to start with degraded email functionality
    }
  }

  // Simple, reliable send method optimized for Railway
  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<SendEmailResult> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Email service not initialized',
      };
    }

    try {
      logger.info('Attempting to send email', { to, subject });

      // Direct send using the reusable transporter (no new connections)
      const info = await this.transporter.sendMail({
        from: this.config.smtp.from,
        to,
        subject,
        text,
        html: html || text,
      });

      logger.info('✅ Email sent successfully', {
        to,
        subject,
        messageId: info.messageId,
        response: info.response?.substring(0, 100), // Truncate long responses
      });

      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('❌ Email send failed:', {
        error: errorMessage,
        to,
        subject,
        errorCode: (error as any)?.code,
        command: (error as any)?.command,
      });

      return {
        success: false,
        error: `Failed to send email: ${errorMessage}`,
      };
    }
  }

  // Inbox reading implementation with error handling
  async getInbox(limit = 10): Promise<Email[]> {
    if (!this.isInitialized) {
      logger.warn('Email service not initialized, returning empty inbox');
      return [];
    }

    try {
      // Return cached emails if available
      if (this.inbox.length > 0) {
        logger.info(`Returning ${Math.min(limit, this.inbox.length)} cached emails`);
        return this.inbox.slice(0, limit);
      }

      // Fetch fresh emails
      logger.info('Fetching fresh emails from inbox');
      const emails = await this.fetchEmails();
      return emails.slice(0, limit);
    } catch (error) {
      logger.error('Get inbox error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  async refreshInbox(): Promise<Email[]> {
    if (!this.isInitialized) {
      logger.warn('Email service not initialized, returning empty inbox');
      return [];
    }

    try {
      logger.info('Refreshing inbox (force fetch)');
      const emails = await this.fetchEmails();
      logger.info(`✅ Refreshed inbox with ${emails.length} emails`);
      return emails;
    } catch (error) {
      logger.error('Refresh inbox error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.inbox; // Return cached emails on error
    }
  }

  private fetchEmails(): Promise<Email[]> {
    return new Promise((resolve, reject) => {
      const emails = new Map<number, Email>();
      let expectedCount = 0;
      let processedCount = 0;
      let timeoutId: NodeJS.Timeout;

      this.imap.once('ready', () => {
        this.imap.openBox('INBOX', false, (err: any, box: any) => {
          if (err) {
            logger.error('IMAP openBox error:', err.message);
            reject(err);
            return;
          }

          expectedCount = box.messages.total;
          logger.info(`Found ${expectedCount} total messages in inbox`);

          if (expectedCount === 0) {
            this.imap.end();
            resolve([]);
            return;
          }

          const f = this.imap.seq.fetch('1:*', {
            bodies: '',
            struct: true,
          });

          f.on('message', (msg: any, seqno: number) => {
            msg.on('body', (stream: any) => {
              simpleParser(stream, (err: any, parsed: any) => {
                if (err) {
                  logger.error(`Parse error for message ${seqno}:`, err.message);
                  processedCount++;
                  return;
                }

                const emailData: Email = {
                  id: seqno,
                  from: parsed.from?.text || 'Unknown',
                  to: parsed.to?.text || 'Unknown',
                  subject: parsed.subject || 'No Subject',
                  text: parsed.text || '',
                  html: parsed.html?.toString() || '',
                  date: parsed.date || new Date(),
                  attachments: parsed.attachments?.length || 0,
                };

                emails.set(seqno, emailData);
                processedCount++;

                // Check if all emails processed
                if (processedCount === expectedCount) {
                  clearTimeout(timeoutId);
                  this.imap.end();
                  const emailArray = Array.from(emails.values());
                  // Sort by date, newest first
                  emailArray.sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
                  );
                  this.inbox = emailArray;
                  logger.info(`✅ Successfully processed ${emailArray.length} emails`);
                  resolve(emailArray);
                }
              });
            });
          });

          f.once('error', (err: any) => {
            clearTimeout(timeoutId);
            logger.error('IMAP fetch error:', err.message);
            reject(err);
          });

          // Timeout fallback - resolve with whatever we have after 5 seconds
          timeoutId = setTimeout(() => {
            if (emails.size > 0) {
              this.imap.end();
              const emailArray = Array.from(emails.values());
              emailArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              this.inbox = emailArray;
              logger.warn(`⚠️ IMAP timeout - returning ${emailArray.length} emails`);
              resolve(emailArray);
            } else {
              reject(new Error('IMAP timeout with no emails fetched'));
            }
          }, 5000);
        });
      });

      this.imap.once('error', (err: any) => {
        logger.error('IMAP connection error:', err.message);
        reject(err);
      });

      logger.info('Connecting to IMAP server...');
      this.imap.connect();
    });
  }

  isServiceReady(): boolean {
    return this.isInitialized;
  }

  // Additional helper method for debugging
  getServiceStatus() {
    return {
      initialized: this.isInitialized,
      transporterReady: !!this.transporter,
      imapReady: !!this.imap,
      cachedEmailCount: this.inbox.length,
    };
  }
}
