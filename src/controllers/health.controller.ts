import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { config } from '../config/env';
import os from 'os';

export class HealthController {
  async health(req: Request, res: Response): Promise<void> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: config.appName,
        version: config.apiVersion,
        database: 'connected',
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: config.appName,
        version: config.apiVersion,
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async metrics(req: Request, res: Response): Promise<void> {
    const metrics = {
      timestamp: new Date().toISOString(),
      service: config.appName,
      version: config.apiVersion,
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage(),
        free: os.freemem(),
        total: os.totalmem(),
      },
      cpu: {
        usage: process.cpuUsage(),
        cores: os.cpus().length,
        loadAverage: os.loadavg(),
      },
      environment: config.env,
    };

    res.json(metrics);
  }
}

export const healthController = new HealthController();