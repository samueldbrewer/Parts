import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { OpenAIRealtimeService, RealtimeConfig } from '../services/openai-realtime.service';
import { config } from '../config/env';
import { verifyWebSocketToken } from '../middleware/websocket-auth.middleware';
import { prisma } from '../config/database';

interface ClientSession {
  id: string;
  userId: string;
  clientWs: WebSocket;
  openaiService: OpenAIRealtimeService;
  createdAt: Date;
  lastActivity: Date;
}

export class VoiceWebSocketHandler {
  private wss: WebSocketServer;
  private sessions: Map<string, ClientSession> = new Map();
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly SESSION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', async (ws: WebSocket, request: IncomingMessage, authData: any) => {
      const sessionId = uuidv4();
      const userId = authData.userId;
      const userEmail = authData.email;
      logger.info('New voice WebSocket connection', { sessionId, userId, userEmail });

      try {
        // Build system instructions with user context
        let instructions =
          'You are a specialized technical manual assistant designed to help users find and obtain technical manuals, user guides, service manuals, and parts lists for commercial and residential equipment.';
        if (userEmail) {
          instructions += `\n\nThe user's email address is: ${userEmail}. You will use this email to send them any manuals they request.`;
        }
        instructions +=
          '\n\nBe concise and friendly. Focus on helping them find the specific manuals they need.';

        const openaiConfig: RealtimeConfig = {
          apiKey: config.openai.apiKey,
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'alloy',
          instructions,
          turnDetection: 'server_vad',
          inputAudioFormat: 'pcm16',
          outputAudioFormat: 'pcm16',
          inputAudioTranscription: {
            model: 'whisper-1',
          },
        };

        const openaiService = new OpenAIRealtimeService(openaiConfig);

        const session: ClientSession = {
          id: sessionId,
          userId,
          clientWs: ws,
          openaiService,
          createdAt: new Date(),
          lastActivity: new Date(),
        };

        this.sessions.set(sessionId, session);
        this.resetSessionTimeout(sessionId);

        await this.createVoiceSessionRecord(sessionId, userId, userEmail);

        await openaiService.connect(sessionId, userEmail || userId);

        this.setupOpenAIListeners(session);
        this.setupClientListeners(session);

        ws.send(
          JSON.stringify({
            type: 'session.created',
            sessionId,
            message: 'Connected to voice service',
          }),
        );
      } catch (error) {
        logger.error('Failed to initialize voice session', { error, sessionId });
        ws.send(
          JSON.stringify({
            type: 'error',
            error: 'Failed to initialize voice session',
          }),
        );
        ws.close(1011, 'Server error');
      }
    });
  }

  private setupOpenAIListeners(session: ClientSession): void {
    const { openaiService, clientWs, id: sessionId } = session;

    openaiService.on('session.created', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'session.created',
          data,
        }),
      );
    });

    openaiService.on('session.updated', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'session.updated',
          data,
        }),
      );
    });

    openaiService.on('conversation.item.created', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'conversation.item.created',
          data,
        }),
      );
    });

    openaiService.on('input_audio_transcription.completed', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'input_audio_transcription.completed',
          data,
        }),
      );
    });

    openaiService.on('response.created', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'response.created',
          data,
        }),
      );
    });

    openaiService.on('response.done', async (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'response.done',
          data,
        }),
      );

      const realtimeSession = openaiService.getSession();
      if (realtimeSession) {
        await this.updateVoiceSessionMetrics(
          sessionId,
          realtimeSession.inputTokens,
          realtimeSession.outputTokens,
        );
      }
    });

    openaiService.on('response.audio.delta', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'response.audio.delta',
          data,
        }),
      );
    });

    openaiService.on('response.audio.done', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'response.audio.done',
          data,
        }),
      );
    });

    openaiService.on('response.text.delta', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'response.text.delta',
          data,
        }),
      );
    });

    openaiService.on('response.text.done', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'response.text.done',
          data,
        }),
      );
    });

    openaiService.on('response.function_call_arguments.delta', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'response.function_call_arguments.delta',
          data,
        }),
      );
    });

    openaiService.on('response.function_call_arguments.done', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'response.function_call_arguments.done',
          data,
        }),
      );
    });

    openaiService.on('error', (error) => {
      logger.error('OpenAI service error', { error, sessionId });
      clientWs.send(
        JSON.stringify({
          type: 'error',
          error: error.message || 'OpenAI service error',
        }),
      );
    });

    openaiService.on('disconnected', () => {
      logger.info('OpenAI service disconnected', { sessionId });
      clientWs.send(
        JSON.stringify({
          type: 'disconnected',
          message: 'OpenAI service disconnected',
        }),
      );
      this.cleanupSession(sessionId);
    });

    openaiService.on('rate_limits.updated', (data) => {
      clientWs.send(
        JSON.stringify({
          type: 'rate_limits.updated',
          data,
        }),
      );
    });
  }

  private setupClientListeners(session: ClientSession): void {
    const { clientWs, openaiService, id: sessionId } = session;

    clientWs.on('message', async (data: Buffer) => {
      try {
        session.lastActivity = new Date();
        this.resetSessionTimeout(sessionId);

        const message = JSON.parse(data.toString());

        switch (message.type) {
          case 'input_audio_buffer.append':
            if (message.audio) {
              const audioBuffer = Buffer.from(message.audio, 'base64');
              openaiService.sendAudio(audioBuffer);
            }
            break;

          case 'input_audio_buffer.commit':
            openaiService.commitAudio();
            break;

          case 'input_audio_buffer.clear':
            openaiService.clearAudio();
            break;

          case 'conversation.item.create':
            if (message.item?.content?.[0]?.text) {
              openaiService.sendText(message.item.content[0].text);
            }
            break;

          case 'response.create':
            openaiService.createResponse();
            break;

          case 'response.cancel':
            openaiService.cancelResponse();
            break;

          case 'conversation.item.truncate':
            clientWs.send(
              JSON.stringify({
                type: 'error',
                error: 'Truncate not yet implemented',
              }),
            );
            break;

          case 'ping':
            clientWs.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            logger.warn('Unknown message type from client', { type: message.type, sessionId });
        }
      } catch (error) {
        logger.error('Error processing client message', { error, sessionId });
        clientWs.send(
          JSON.stringify({
            type: 'error',
            error: 'Failed to process message',
          }),
        );
      }
    });

    clientWs.on('close', () => {
      logger.info('Client WebSocket closed', { sessionId });
      this.cleanupSession(sessionId);
    });

    clientWs.on('error', (error) => {
      logger.error('Client WebSocket error', { error, sessionId });
      this.cleanupSession(sessionId);
    });

    clientWs.on('pong', () => {
      session.lastActivity = new Date();
    });
  }

  private resetSessionTimeout(sessionId: string): void {
    const existingTimeout = this.sessionTimeouts.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      logger.info('Session timeout', { sessionId });
      this.cleanupSession(sessionId);
    }, this.SESSION_TIMEOUT_MS);

    this.sessionTimeouts.set(sessionId, timeout);
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.openaiService.disconnect();

      if (session.clientWs.readyState === WebSocket.OPEN) {
        session.clientWs.close(1000, 'Session ended');
      }

      await this.finalizeVoiceSession(sessionId);

      this.sessions.delete(sessionId);
    }

    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  async handleUpgrade(request: IncomingMessage, socket: any, head: Buffer): Promise<void> {
    try {
      const authData = await verifyWebSocketToken(request);

      if (!authData) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request, authData);
      });
    } catch (error) {
      logger.error('WebSocket upgrade failed', { error });
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  }

  private async createVoiceSessionRecord(
    sessionId: string,
    userId: string,
    userEmail?: string,
  ): Promise<void> {
    try {
      await prisma.voiceSession.create({
        data: {
          id: sessionId,
          userId,
          startTime: new Date(),
          status: 'active',
          inputTokens: 0,
          outputTokens: 0,
          inputAudioTokens: 0,
          outputAudioTokens: 0,
          metadata: userEmail ? { email: userEmail } : {},
        },
      });
    } catch (error) {
      logger.error('Failed to create voice session record', { error, sessionId });
    }
  }

  private async updateVoiceSessionMetrics(
    sessionId: string,
    inputTokens: number,
    outputTokens: number,
  ): Promise<void> {
    try {
      await prisma.voiceSession.update({
        where: { id: sessionId },
        data: {
          inputTokens,
          outputTokens,
        },
      });
    } catch (error) {
      logger.error('Failed to update voice session metrics', { error, sessionId });
    }
  }

  private async finalizeVoiceSession(sessionId: string): Promise<void> {
    try {
      const session = this.sessions.get(sessionId);
      const realtimeSession = session?.openaiService.getSession();

      await prisma.voiceSession.update({
        where: { id: sessionId },
        data: {
          endTime: new Date(),
          status: 'completed',
          inputTokens: realtimeSession?.inputTokens || 0,
          outputTokens: realtimeSession?.outputTokens || 0,
        },
      });
    } catch (error) {
      logger.error('Failed to finalize voice session', { error, sessionId });
    }
  }

  getActiveSessions(): number {
    return this.sessions.size;
  }

  getSessionInfo(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const realtimeSession = session.openaiService.getSession();
    return {
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      openaiStatus: realtimeSession?.status,
      inputTokens: realtimeSession?.inputTokens || 0,
      outputTokens: realtimeSession?.outputTokens || 0,
    };
  }
}
