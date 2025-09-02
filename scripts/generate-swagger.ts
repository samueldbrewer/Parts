import fs from 'fs';
import path from 'path';
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Parts API - Voice-Enabled REST API',
      version: '2.0.0',
      description:
        'Production-ready API with OpenAI Realtime voice capabilities, built with TypeScript, Express, PostgreSQL, and Prisma',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'https://parts.up.railway.app/api/v1',
        description: 'Production server',
      },
      {
        url: 'wss://parts.up.railway.app/api/v1',
        description: 'Production WebSocket',
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server',
      },
      {
        url: 'ws://localhost:3000/api/v1',
        description: 'Development WebSocket',
      },
    ],
    paths: {
      '/': {
        get: {
          tags: ['General'],
          summary: 'API Welcome',
          description: 'Returns basic API information and available endpoints',
          responses: {
            200: {
              description: 'API information',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      version: { type: 'string' },
                      endpoints: {
                        type: 'object',
                        properties: {
                          health: { type: 'string' },
                          metrics: { type: 'string' },
                          docs: { type: 'string' },
                          voice: {
                            type: 'object',
                            properties: {
                              token: { type: 'string' },
                              websocket: { type: 'string' },
                              sessions: { type: 'string' },
                              usage: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/health': {
        get: {
          tags: ['Monitoring'],
          summary: 'Health check',
          description: 'Returns the health status of the service including database connectivity',
          responses: {
            200: {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'healthy' },
                      timestamp: { type: 'string', format: 'date-time' },
                      service: { type: 'string' },
                      version: { type: 'string' },
                      database: { type: 'string', example: 'connected' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/metrics': {
        get: {
          tags: ['Monitoring'],
          summary: 'System metrics',
          description: 'Returns system metrics including CPU, memory, and uptime',
          responses: {
            200: {
              description: 'System metrics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      timestamp: { type: 'string', format: 'date-time' },
                      service: { type: 'string' },
                      version: { type: 'string' },
                      uptime: { type: 'number' },
                      memory: { type: 'object' },
                      cpu: { type: 'object' },
                      environment: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/voice/token': {
        get: {
          tags: ['Voice'],
          summary: 'Get WebSocket connection token',
          description:
            'Generate a JWT token for establishing a WebSocket connection to the voice endpoint',
          security: [{ bearerAuth: [] }, { apiKey: [] }],
          responses: {
            200: {
              description: 'Connection token and WebSocket details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          token: {
                            type: 'string',
                            description: 'JWT token for WebSocket authentication',
                            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                          },
                          url: {
                            type: 'string',
                            description: 'WebSocket endpoint URL',
                            example: 'wss://parts.up.railway.app/api/v1/voice/realtime',
                          },
                          expiresIn: {
                            type: 'number',
                            description: 'Token expiration time in seconds',
                            example: 3600,
                          },
                          model: {
                            type: 'string',
                            description: 'OpenAI Realtime model being used',
                            example: 'gpt-realtime',
                          },
                          supportedFormats: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['pcm16', 'g711_ulaw', 'g711_alaw'],
                          },
                          defaultFormat: {
                            type: 'string',
                            example: 'pcm16',
                          },
                          sampleRate: {
                            type: 'number',
                            description: 'Audio sample rate in Hz',
                            example: 24000,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/voice/health': {
        get: {
          tags: ['Voice'],
          summary: 'Voice service health check',
          description: 'Check the health and configuration status of the voice service',
          responses: {
            200: {
              description: 'Voice service status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          status: {
                            type: 'string',
                            enum: ['healthy', 'missing_configuration'],
                            example: 'healthy',
                          },
                          activeSessions: {
                            type: 'number',
                            description: 'Number of active WebSocket sessions',
                            example: 0,
                          },
                          openaiConfigured: {
                            type: 'boolean',
                            description: 'Whether OpenAI API key is configured',
                            example: true,
                          },
                          supportedModels: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['gpt-realtime'],
                          },
                          websocketEndpoint: {
                            type: 'string',
                            example: '/api/v1/voice/realtime',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/voice/sessions': {
        get: {
          tags: ['Voice'],
          summary: 'Get voice session history',
          description: 'Retrieve voice session history for the authenticated user',
          security: [{ bearerAuth: [] }, { apiKey: [] }],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              description: 'Number of sessions to return',
              required: false,
              schema: { type: 'integer', default: 10 },
            },
            {
              name: 'offset',
              in: 'query',
              description: 'Number of sessions to skip',
              required: false,
              schema: { type: 'integer', default: 0 },
            },
            {
              name: 'status',
              in: 'query',
              description: 'Filter by session status',
              required: false,
              schema: {
                type: 'string',
                enum: ['active', 'completed', 'error'],
              },
            },
          ],
          responses: {
            200: {
              description: 'List of voice sessions',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          sessions: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                userId: { type: 'string' },
                                startTime: { type: 'string', format: 'date-time' },
                                endTime: { type: 'string', format: 'date-time', nullable: true },
                                status: { type: 'string' },
                                duration: { type: 'number', nullable: true },
                                inputTokens: { type: 'integer' },
                                outputTokens: { type: 'integer' },
                                estimatedCost: { type: 'number' },
                              },
                            },
                          },
                          pagination: {
                            type: 'object',
                            properties: {
                              total: { type: 'integer' },
                              limit: { type: 'integer' },
                              offset: { type: 'integer' },
                              hasMore: { type: 'boolean' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/voice/sessions/{sessionId}': {
        get: {
          tags: ['Voice'],
          summary: 'Get specific voice session details',
          description:
            'Get detailed information about a specific voice session including conversation history',
          security: [{ bearerAuth: [] }, { apiKey: [] }],
          parameters: [
            {
              name: 'sessionId',
              in: 'path',
              description: 'Voice session ID',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: {
              description: 'Session details with conversation history',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          session: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              userId: { type: 'string' },
                              startTime: { type: 'string', format: 'date-time' },
                              endTime: { type: 'string', format: 'date-time', nullable: true },
                              status: { type: 'string' },
                              duration: { type: 'number', nullable: true },
                              inputTokens: { type: 'integer' },
                              outputTokens: { type: 'integer' },
                              inputAudioTokens: { type: 'integer' },
                              outputAudioTokens: { type: 'integer' },
                              estimatedCost: { type: 'number' },
                            },
                          },
                          conversations: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                sessionId: { type: 'string' },
                                role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                                contentType: { type: 'string', enum: ['text', 'audio'] },
                                content: { type: 'string' },
                                timestamp: { type: 'string', format: 'date-time' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            404: {
              description: 'Session not found',
            },
          },
        },
      },
      '/voice/usage': {
        get: {
          tags: ['Voice'],
          summary: 'Get voice usage statistics',
          description: 'Get usage statistics including token counts and estimated costs',
          security: [{ bearerAuth: [] }, { apiKey: [] }],
          parameters: [
            {
              name: 'period',
              in: 'query',
              description: 'Time period for statistics',
              required: false,
              schema: {
                type: 'string',
                enum: ['1h', '1d', '7d', '30d'],
                default: '7d',
              },
            },
          ],
          responses: {
            200: {
              description: 'Usage statistics with cost breakdown',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          period: { type: 'string' },
                          startDate: { type: 'string', format: 'date-time' },
                          sessions: { type: 'integer' },
                          totalDurationSeconds: { type: 'integer' },
                          totalDurationMinutes: { type: 'integer' },
                          tokens: {
                            type: 'object',
                            properties: {
                              input: { type: 'integer' },
                              output: { type: 'integer' },
                              inputAudio: { type: 'integer' },
                              outputAudio: { type: 'integer' },
                            },
                          },
                          estimatedCost: {
                            type: 'object',
                            properties: {
                              total: { type: 'number' },
                              breakdown: {
                                type: 'object',
                                properties: {
                                  textInput: { type: 'number' },
                                  textOutput: { type: 'number' },
                                  audioInput: { type: 'number' },
                                  audioOutput: { type: 'number' },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/voice/realtime': {
        get: {
          tags: ['Voice WebSocket'],
          summary: 'WebSocket endpoint for real-time voice communication',
          description: `Establish a WebSocket connection for real-time voice interaction with OpenAI's latest gpt-realtime model (September 2025).
          
## Connection URL
\`\`\`
wss://parts.up.railway.app/api/v1/voice/realtime?token=YOUR_TOKEN
\`\`\`

## Authentication
Include the token from /voice/token endpoint as a query parameter or in Authorization header.

## Message Format

### Client to Server Messages:
- **Send Audio**: \`{ "type": "input_audio_buffer.append", "audio": "base64_encoded_audio" }\`
- **Commit Audio**: \`{ "type": "input_audio_buffer.commit" }\`
- **Clear Audio**: \`{ "type": "input_audio_buffer.clear" }\`
- **Send Text**: \`{ "type": "conversation.item.create", "item": { "content": [{ "text": "Hello" }] } }\`
- **Create Response**: \`{ "type": "response.create" }\`
- **Cancel Response**: \`{ "type": "response.cancel" }\`

### Server to Client Messages:
- **Session Created**: Confirms connection established
- **Audio Response**: Streaming audio chunks in base64
- **Text Response**: Streaming text transcription
- **Response Done**: Indicates completion with token usage

## Audio Format
- Default: PCM16 24kHz mono
- Supported: PCM16, G.711 µ-law, G.711 A-law`,
          security: [{ bearerAuth: [] }, { apiKey: [] }],
          responses: {
            101: {
              description: 'WebSocket connection established',
            },
            401: {
              description: 'Unauthorized - Invalid or missing token',
            },
          },
        },
      },
      '/admin/migrate': {
        post: {
          tags: ['Admin'],
          summary: 'Run database migrations',
          description: 'Manually trigger database migrations (requires master API key)',
          security: [{ apiKey: [] }],
          responses: {
            200: {
              description: 'Migrations completed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      message: { type: 'string' },
                      output: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized - Invalid API key',
            },
            500: {
              description: 'Migration failed',
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token',
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string' },
            code: { type: 'string' },
            stack: { type: 'string' },
          },
        },
      },
    },
    tags: [
      {
        name: 'General',
        description: 'General API endpoints',
      },
      {
        name: 'Monitoring',
        description: 'Health and metrics endpoints',
      },
      {
        name: 'Voice',
        description: 'Voice communication endpoints for managing sessions and tokens',
      },
      {
        name: 'Voice WebSocket',
        description: 'Real-time WebSocket endpoint for voice streaming',
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints (requires special authentication)',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

// Write to file
fs.writeFileSync(path.join(__dirname, '..', 'swagger.json'), JSON.stringify(swaggerSpec, null, 2));

console.log('✅ Swagger documentation generated successfully!');
console.log('📄 File saved to: swagger.json');
console.log('🎙️ Voice API endpoints documented');
console.log('🔌 WebSocket endpoint documented');
console.log('📊 View at: https://parts.up.railway.app/api-docs');
