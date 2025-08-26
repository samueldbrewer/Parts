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

  // CRITICAL: Non-blocking initialization for cloud deployment
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing email service with proven configuration');

      // Create SMTP transporter with connection pooling
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: false,
        requireTLS: true,
        auth: {
          user: this.cleanEnvVar(this.config.smtp.user),
          pass: this.cleanEnvVar(this.config.smtp.pass),
        },
        tls: {
          rejectUnauthorized: false, // CRITICAL for Railway/cloud
        },
        // Connection pooling for efficiency
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        // Cloud-optimized timeouts
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      });

      // Try SMTP verification but don't fail if it times out
      try {
        await this.transporter.verify();
        logger.info('✅ SMTP server ready');
      } catch (error) {
        logger.warn('⚠️ SMTP verification failed, will attempt sends anyway:', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't throw - allow service to continue
      }

      // Initialize IMAP for inbox reading
      this.imap = new Imap({
        user: this.cleanEnvVar(this.config.imap.user) || '',
        password: this.cleanEnvVar(this.config.imap.pass) || '',
        host: this.config.imap.host,
        port: this.config.imap.port,
        tls: this.config.imap.tls,
        tlsOptions: { rejectUnauthorized: false },
      });

      this.isInitialized = true;
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Email service initialization failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - allow degraded functionality
    }
  }

  // Simple, reliable send method
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
      const info = await this.transporter.sendMail({
        from: this.config.smtp.from,
        to,
        subject,
        text,
        html: html || text,
      });

      logger.info('Email sent successfully', {
        to,
        subject,
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      logger.error('Email send failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to,
        subject,
      });
      return {
        success: false,
        error: `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // Inbox reading implementation
  async getInbox(limit = 10): Promise<Email[]> {
    try {
      if (this.inbox.length > 0) {
        return this.inbox.slice(0, limit);
      }

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
    try {
      const emails = await this.fetchEmails();
      return emails;
    } catch (error) {
      logger.error('Refresh inbox error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.inbox;
    }
  }

  private fetchEmails(): Promise<Email[]> {
    return new Promise((resolve, reject) => {
      const emails = new Map<number, Email>();
      let expectedCount = 0;
      let processedCount = 0;

      this.imap.once('ready', () => {
        this.imap.openBox('INBOX', false, (err: any, box: any) => {
          if (err) {
            reject(err);
            return;
          }

          expectedCount = box.messages.total;

          if (expectedCount === 0) {
            this.imap.end();
            resolve([]);
            return;
          }

          const f = this.imap.seq.fetch('1:*', {
            bodies: '',
            struct: true,
          });

          f.on('message', (msg, seqno) => {
            msg.on('body', (stream: any) => {
              simpleParser(stream, (err: any, parsed: any) => {
                if (err) {
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

                if (processedCount === expectedCount) {
                  this.imap.end();
                  const emailArray = Array.from(emails.values());
                  emailArray.sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
                  );
                  this.inbox = emailArray;
                  resolve(emailArray);
                }
              });
            });
          });

          f.once('error', reject);

          // Timeout fallback
          setTimeout(() => {
            if (emails.size > 0) {
              this.imap.end();
              const emailArray = Array.from(emails.values());
              emailArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              this.inbox = emailArray;
              resolve(emailArray);
            }
          }, 5000);
        });
      });

      this.imap.once('error', reject);
      this.imap.connect();
    });
  }

  isServiceReady(): boolean {
    return this.isInitialized;
  }
}
