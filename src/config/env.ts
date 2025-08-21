import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_VERSION: Joi.string().default('v1'),
  APP_NAME: Joi.string().default('Parts API'),
  
  DATABASE_URL: Joi.string().required(),
  DATABASE_POOL_MIN: Joi.number().default(2),
  DATABASE_POOL_MAX: Joi.number().default(10),
  
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  
  API_KEY_HEADER: Joi.string().default('X-API-Key'),
  MASTER_API_KEY: Joi.string().required(),
  
  BCRYPT_ROUNDS: Joi.number().default(10),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  
  CORS_ORIGIN: Joi.string().default('*'),
  CORS_CREDENTIALS: Joi.boolean().default(true),
  
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('json'),
  LOG_DIR: Joi.string().default('./logs'),
  
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().default(9090),
  
  SWAGGER_ENABLED: Joi.boolean().default(true),
  SWAGGER_PATH: Joi.string().default('/api-docs'),
  
  REDIS_URL: Joi.string().optional(),
  REDIS_TTL: Joi.number().default(3600),
  
  MAX_FILE_SIZE: Joi.number().default(10485760),
  UPLOAD_DIR: Joi.string().default('./uploads'),
}).unknown(true);

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  apiVersion: envVars.API_VERSION,
  appName: envVars.APP_NAME,
  
  database: {
    url: envVars.DATABASE_URL,
    poolMin: envVars.DATABASE_POOL_MIN,
    poolMax: envVars.DATABASE_POOL_MAX,
  },
  
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
  },
  
  apiKey: {
    header: envVars.API_KEY_HEADER,
    masterKey: envVars.MASTER_API_KEY,
  },
  
  security: {
    bcryptRounds: envVars.BCRYPT_ROUNDS,
    rateLimitWindowMs: envVars.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
  },
  
  cors: {
    origin: envVars.CORS_ORIGIN.split(','),
    credentials: envVars.CORS_CREDENTIALS,
  },
  
  logging: {
    level: envVars.LOG_LEVEL,
    format: envVars.LOG_FORMAT,
    dir: envVars.LOG_DIR,
  },
  
  metrics: {
    enabled: envVars.ENABLE_METRICS,
    port: envVars.METRICS_PORT,
  },
  
  swagger: {
    enabled: envVars.SWAGGER_ENABLED,
    path: envVars.SWAGGER_PATH,
  },
  
  redis: {
    url: envVars.REDIS_URL,
    ttl: envVars.REDIS_TTL,
  },
  
  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    dir: envVars.UPLOAD_DIR,
  },
};