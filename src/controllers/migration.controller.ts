import { Request, Response } from 'express';
import { execSync } from 'child_process';
import { config } from '../config/env';

class MigrationController {
  runMigrations = async (req: Request, res: Response): Promise<void> => {
    try {
      // Check for master API key
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;

      if (apiKey !== config.apiKey.masterKey) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized - Invalid API key',
        });
        return;
      }

      // Run migrations
      const output = execSync('npx prisma migrate deploy', {
        encoding: 'utf-8',
        env: process.env,
      });

      res.json({
        success: true,
        message: 'Migrations completed successfully',
        output: output.split('\n').filter((line) => line.trim()),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Migration failed',
        message: error.message,
        output: error.stdout?.toString() || error.stderr?.toString(),
      });
    }
  };
}

export const migrationController = new MigrationController();
