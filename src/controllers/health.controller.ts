import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { config } from '../config/env';
import os from 'os';

export class HealthController {
  async health(req: Request, res: Response): Promise<void> {
    let databaseStatus = 'unknown';
    let databaseError: string | undefined;
    
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'connected';
    } catch (error) {
      databaseStatus = 'disconnected';
      databaseError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    const isHealthy = true; // App is healthy even if DB is down
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: config.appName,
      version: config.apiVersion,
      database: databaseStatus,
      ...(databaseError && { databaseError }),
    });
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