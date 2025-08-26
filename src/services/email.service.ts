import nodemailer, { Transporter } from 'nodemailer';
import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
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
  private transporter: Transporter | null = null;
  private imap: Imap | null = null;
  private inbox: Email[] = [];
  private isInitialized = false;
  private smtpVerified = false;

  constructor(private config: EmailConfig) {}

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing SMTP transporter...', {
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        user: this.config.smtp.user,
      });

      // Initialize SMTP transporter for sending emails - Railway-friendly config
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        host: this.config.smtp.host,
        port: this.config.smtp.port,
        secure: false,
        auth: {
          user: this.config.smtp.user,
          pass: this.config.smtp.pass,
        },
        // Railway-optimized timeouts
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 30000,
      });

      logger.info('Initializing IMAP configuration...', {
        host: this.config.imap.host,
        port: this.config.imap.port,
        user: this.config.imap.user,
      });

      // Initialize IMAP for receiving emails (lazy initialization)
      this.imap = new Imap({
        user: this.config.imap.user,
        password: this.config.imap.pass,
        host: this.config.imap.host,
        port: this.config.imap.port,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: 20000,
        authTimeout: 10000,
      });

      // Mark as ready immediately - no blocking verification
      this.isInitialized = true;
      logger.info('Email service initialized - SMTP verification will happen on first send');
    } catch (error) {
      logger.error('Failed to initialize email service', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ): Promise<SendEmailResult> {
    if (!this.isInitialized || !this.transporter) {
      throw new Error('Email service not initialized');
    }

    // Lazy SMTP verification on first send
    if (!this.smtpVerified) {
      try {
        await Promise.race([
          this.transporter.verify(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SMTP verification timeout')), 10000),
          ),
        ]);
        this.smtpVerified = true;
        logger.info('✅ SMTP connection verified');
      } catch (error) {
        logger.warn('⚠️ SMTP verification failed, attempting send anyway:', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't throw - attempt to send anyway
      }
    }

    // Send with retry logic
    return await this.attemptSend(to, subject, text, html);
  }

  private async attemptSend(
    to: string,
    subject: string,
    text: string,
    html?: string,
    retries = 3,
  ): Promise<SendEmailResult> {
    for (let i = 0; i < retries; i++) {
      try {
        const mailOptions = {
          from: this.config.smtp.from,
          to,
          subject,
          text,
          html: html || text,
        };

        const info = await this.transporter!.sendMail(mailOptions);

        logger.info('Email sent successfully', {
          to,
          subject,
          messageId: info.messageId,
          attempt: i + 1,
        });

        return {
          success: true,
          messageId: info.messageId,
          response: info.response,
        };
      } catch (error) {
        logger.error(`Send attempt ${i + 1} failed:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          to,
          subject,
        });

        if (i === retries - 1) {
          return {
            success: false,
            error: `Failed to send email after ${retries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }

        // Wait before retry with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      success: false,
      error: 'Unexpected error in send retry logic',
    };
  }

  async fetchEmails(): Promise<Email[]> {
    if (!this.imap) {
      throw new Error('IMAP not initialized');
    }

    return new Promise((resolve, reject) => {
      const emails = new Map<number, Email>();
      let expectedCount = 0;
      let processedCount = 0;

      this.imap!.once('ready', () => {
        this.imap!.openBox('INBOX', false, (err: any, box: any) => {
          if (err) {
            logger.error('Failed to open INBOX', { error: err.message });
            reject(err);
            return;
          }

          expectedCount = box.messages.total;
          logger.info('Fetching emails from inbox', { totalEmails: expectedCount });

          if (expectedCount === 0) {
            this.imap!.end();
            resolve([]);
            return;
          }

          const f = this.imap!.seq.fetch('1:*', {
            bodies: '',
            struct: true,
          });

          f.on('message', (msg, seqno) => {
            msg.on('body', (stream: any) => {
              simpleParser(stream, (err: any, parsed: ParsedMail) => {
                if (err) {
                  logger.warn('Failed to parse email', { seqno, error: err.message });
                  processedCount++;
                  return;
                }

                // Helper function to extract email address text
                const getAddressText = (addr: any): string => {
                  if (!addr) return 'Unknown';
                  if (typeof addr === 'string') return addr;
                  if (Array.isArray(addr))
                    return addr.map((a) => a.text || a.address || 'Unknown').join(', ');
                  return addr.text || addr.address || 'Unknown';
                };

                const emailData: Email = {
                  id: seqno,
                  from: getAddressText(parsed.from),
                  to: getAddressText(parsed.to),
                  subject: parsed.subject || 'No Subject',
                  text: parsed.text || '',
                  html: parsed.html?.toString() || '',
                  date: parsed.date || new Date(),
                  attachments: parsed.attachments?.length || 0,
                };

                emails.set(seqno, emailData);
                processedCount++;

                if (processedCount === expectedCount) {
                  this.imap!.end();
                  const emailArray = Array.from(emails.values());
                  emailArray.sort(
                    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
                  );
                  this.inbox = emailArray;
                  logger.info('Successfully fetched emails', { count: emailArray.length });
                  resolve(emailArray);
                }
              });
            });
          });

          f.once('error', (err) => {
            logger.error('IMAP fetch error', { error: err.message });
            reject(err);
          });

          // Timeout fallback after 10 seconds
          setTimeout(() => {
            if (emails.size > 0) {
              this.imap!.end();
              const emailArray = Array.from(emails.values());
              emailArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              this.inbox = emailArray;
              logger.info('Fetched emails with timeout', { count: emailArray.length });
              resolve(emailArray);
            } else {
              reject(new Error('Timeout: No emails fetched'));
            }
          }, 10000);
        });
      });

      this.imap!.once('error', (err: any) => {
        logger.error('IMAP connection error', { error: err.message });
        reject(err);
      });

      this.imap!.connect();
    });
  }

  async getInbox(limit = 10): Promise<Email[]> {
    try {
      if (this.inbox.length > 0) {
        return this.inbox.slice(0, limit);
      }
      const emails = await this.fetchEmails();
      return emails.slice(0, limit);
    } catch (error) {
      logger.error('Get inbox error', {
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
      logger.error('Refresh inbox error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.inbox;
    }
  }

  isServiceReady(): boolean {
    return this.isInitialized;
  }
}
