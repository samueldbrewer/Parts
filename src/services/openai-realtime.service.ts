import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { FunctionToolsService } from './function-tools.service';

export interface RealtimeConfig {
  apiKey: string;
  model?: string;
  voice?: string;
  instructions?: string;
  turnDetection?: 'server_vad' | 'none';
  inputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  outputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  inputAudioTranscription?: {
    model?: string;
  };
  tools?: Array<{
    type: string;
    name: string;
    description?: string;
    parameters?: any;
  }>;
}

export interface RealtimeSession {
  id: string;
  userId?: string;
  config: RealtimeConfig;
  startTime: Date;
  endTime?: Date;
  inputTokens: number;
  outputTokens: number;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export class OpenAIRealtimeService extends EventEmitter {
  private ws: WebSocket | null = null;
  private session: RealtimeSession | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private readonly baseUrl = 'wss://api.openai.com/v1/realtime';

  constructor(private config: RealtimeConfig) {
    super();
  }

  async connect(sessionId: string, userId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.baseUrl}?model=${this.config.model || 'gpt-realtime'}`;

        this.session = {
          id: sessionId,
          userId,
          config: this.config,
          startTime: new Date(),
          inputTokens: 0,
          outputTokens: 0,
          status: 'connecting',
        };

        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        });

        this.ws.on('open', () => {
          logger.info('OpenAI Realtime WebSocket connected', { sessionId });
          this.session!.status = 'connected';
          this.setupHeartbeat();
          this.sendSessionUpdate();
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          logger.error('OpenAI Realtime WebSocket error', { error, sessionId });
          this.session!.status = 'error';
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          logger.info('OpenAI Realtime WebSocket closed', {
            code,
            reason: reason.toString(),
            sessionId,
          });
          this.handleDisconnect();
        });
      } catch (error) {
        logger.error('Failed to connect to OpenAI Realtime', { error, sessionId });
        reject(error);
      }
    });
  }

  private sendSessionUpdate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const sessionUpdate = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        voice: this.config.voice || 'alloy',
        instructions:
          this.config.instructions ||
          `You are a helpful manual search assistant. You help people find technical manuals and documentation for their equipment.

KEY BEHAVIORS:
- When someone mentions specific equipment/model → immediately search for manuals
- Default to searching for service/technical manuals (manual_type: "service_manual")
- Be conversational and friendly, but concise
- Respond naturally to greetings, questions, and general conversation

WHEN SEARCHING:
• User mentions "Carrier 58CVA" → Search for it and say "Found 3 technical manuals for the Carrier 58CVA. Would you like me to email them?"
• User mentions "Samsung RF28" → Search and report what you found
• Always search for service manuals by default unless they specifically ask for user manual

CONVERSATIONAL:
- Respond to "hello", "how are you", "thanks" naturally
- Answer questions about what you can do
- Be helpful and friendly
- Keep responses brief but warm

WHEN YOU FIND MANUALS:
- "Found [X] technical manuals for [equipment]. Want them emailed?"
- If email provided, send immediately
- If no email yet, ask for it

Remember: Be helpful, friendly, and action-oriented when appropriate.`,
        input_audio_format: this.config.inputAudioFormat || 'pcm16',
        output_audio_format: this.config.outputAudioFormat || 'pcm16',
        turn_detection:
          this.config.turnDetection === 'none'
            ? null
            : {
                type: this.config.turnDetection || 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 200,
              },
        input_audio_transcription: this.config.inputAudioTranscription || {
          model: 'whisper-1',
        },
        tools: this.config.tools || FunctionToolsService.getAvailableTools(),
        tool_choice: 'auto',
        temperature: 0.8,
        max_response_output_tokens: 4096,
      },
    };

    this.ws.send(JSON.stringify(sessionUpdate));
    logger.debug('Session update sent', { sessionId: this.session?.id });
  }

  private async handleFunctionCall(message: any): Promise<void> {
    try {
      // Log the full message structure for debugging
      logger.debug('Raw function call message', {
        message,
        messageKeys: Object.keys(message),
        sessionId: this.session?.id,
      });

      const callId = message.call_id;
      const functionName = message.name;
      const args = JSON.parse(message.arguments || '{}');

      logger.info('Executing function call', {
        callId,
        functionName,
        args,
        messageType: message.type,
        sessionId: this.session?.id,
      });

      // Execute the function
      const result = await FunctionToolsService.executeFunction(functionName, args);

      // Send the result back to OpenAI
      const functionResult = {
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(result.data || { error: result.error }),
        },
      };

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(functionResult));

        // Trigger response generation
        const responseCreate = {
          type: 'response.create',
        };
        this.ws.send(JSON.stringify(responseCreate));
      }

      logger.info('Function call completed', {
        callId,
        functionName,
        success: result.success,
        sessionId: this.session?.id,
      });
    } catch (error) {
      logger.error('Function call execution failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        message,
        sessionId: this.session?.id,
      });
    }
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Log all message types for debugging
      logger.debug('Received message', {
        type: message.type,
        sessionId: this.session?.id,
      });

      switch (message.type) {
        case 'session.created':
          logger.info('Session created', {
            sessionId: message.session.id,
            model: message.session.model,
          });
          this.emit('session.created', message);
          break;

        case 'session.updated':
          logger.debug('Session updated', { sessionId: this.session?.id });
          this.emit('session.updated', message);
          break;

        case 'conversation.item.created':
          this.emit('conversation.item.created', message);
          break;

        case 'conversation.item.input_audio_transcription.completed':
          this.emit('input_audio_transcription.completed', message);
          break;

        case 'response.created':
          this.emit('response.created', message);
          break;

        case 'response.done':
          if (message.response.usage) {
            this.session!.inputTokens += message.response.usage.input_tokens || 0;
            this.session!.outputTokens += message.response.usage.output_tokens || 0;

            const inputAudioTokens = message.response.usage.input_token_details?.audio_tokens || 0;
            const outputAudioTokens =
              message.response.usage.output_token_details?.audio_tokens || 0;

            logger.info('Response completed', {
              sessionId: this.session?.id,
              totalInputTokens: this.session?.inputTokens,
              totalOutputTokens: this.session?.outputTokens,
              inputAudioTokens,
              outputAudioTokens,
            });
          }
          this.emit('response.done', message);
          break;

        case 'response.audio.delta':
          this.emit('response.audio.delta', message);
          break;

        case 'response.audio.done':
          this.emit('response.audio.done', message);
          break;

        case 'response.text.delta':
          this.emit('response.text.delta', message);
          break;

        case 'response.text.done':
          this.emit('response.text.done', message);
          break;

        case 'response.function_call_arguments.delta':
          this.emit('response.function_call_arguments.delta', message);
          break;

        case 'response.function_call_arguments.done':
          this.emit('response.function_call_arguments.done', message);
          // Execute the function call
          this.handleFunctionCall(message);
          break;

        case 'error':
          logger.error('OpenAI Realtime error', {
            error: message.error,
            sessionId: this.session?.id,
          });
          this.emit('error', message.error);
          break;

        case 'rate_limits.updated':
          logger.debug('Rate limits updated', {
            limits: message.rate_limits,
            sessionId: this.session?.id,
          });
          this.emit('rate_limits.updated', message);
          break;

        default:
          logger.debug('Unhandled message type', {
            type: message.type,
            sessionId: this.session?.id,
          });
          this.emit('message', message);
      }
    } catch (error) {
      logger.error('Failed to parse OpenAI message', { error, data: data.toString() });
    }
  }

  sendAudio(audioData: Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const message = {
      type: 'input_audio_buffer.append',
      audio: audioData.toString('base64'),
    };

    this.ws.send(JSON.stringify(message));
  }

  commitAudio(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
  }

  clearAudio(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
  }

  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const message = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: text,
          },
        ],
      },
    };

    this.ws.send(JSON.stringify(message));
    this.createResponse();
  }

  createResponse(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({ type: 'response.create' }));
  }

  cancelResponse(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify({ type: 'response.cancel' }));
  }

  sendFunctionResult(callId: string, result: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const message = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result),
      },
    };

    this.ws.send(JSON.stringify(message));
  }

  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private handleDisconnect(): void {
    if (this.session) {
      this.session.status = 'disconnected';
      this.session.endTime = new Date();
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.emit('disconnected');
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.session) {
      this.session.status = 'disconnected';
      this.session.endTime = new Date();
    }
  }

  getSession(): RealtimeSession | null {
    return this.session;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
