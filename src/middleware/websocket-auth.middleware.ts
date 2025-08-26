import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export async function verifyWebSocketToken(request: IncomingMessage): Promise<string | null> {
  try {
    let token: string | undefined;

    // Check for token in query parameters (common for WebSocket)
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    token = url.searchParams.get('token') || undefined;

    // If not in query, check Authorization header
    if (!token && request.headers.authorization) {
      const authHeader = request.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    // Check for API key as alternative authentication
    const apiKey = url.searchParams.get('apiKey') || (request.headers['x-api-key'] as string);
    if (!token && apiKey) {
      // For demo purposes, accept the master API key
      // In production, you'd validate against user-specific API keys
      if (apiKey === config.apiKey.masterKey) {
        return 'api-key-user'; // Return a default user ID for API key auth
      }
    }

    if (!token) {
      logger.warn('WebSocket connection attempt without token');
      return null;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as any;

    if (!decoded.userId && !decoded.id) {
      logger.warn('WebSocket token missing user ID');
      return null;
    }

    return decoded.userId || decoded.id;
  } catch (error) {
    logger.error('WebSocket authentication failed', { error });
    return null;
  }
}

export function generateWebSocketToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'websocket' },
    config.jwt.secret,
    { expiresIn: '1h' }, // WebSocket tokens have shorter expiry
  );
}
