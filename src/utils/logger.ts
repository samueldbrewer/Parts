import winston from 'winston';
import path from 'path';
import { config } from '../config/env';

const { combine, timestamp, errors, json, simple, colorize, printf } = winston.format;

const customFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: config.logging.format === 'json' 
      ? json() 
      : combine(colorize(), simple()),
  }),
];

if (config.env !== 'test') {
  transports.push(
    new winston.transports.File({
      filename: path.join(config.logging.dir, 'error.log'),
      level: 'error',
      format: json(),
    }),
    new winston.transports.File({
      filename: path.join(config.logging.dir, 'combined.log'),
      format: json(),
    })
  );
}

export const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    config.logging.format === 'json' ? json() : customFormat
  ),
  transports,
  exitOnError: false,
});

export const httpLogger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(config.logging.dir, 'http.log'),
    }),
  ],
});