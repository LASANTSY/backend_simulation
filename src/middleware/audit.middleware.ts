import { Request, Response, NextFunction } from 'express';
import DataSanitizer from '../utils/data-sanitizer';
import AppDataSource from '../data-source';
import AuditLog from '../entities/AuditLog';
import logger from '../etl/logger';

export default async function AuditMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const body = req.body;
  const sanitized = DataSanitizer.sanitize(body);

  // hook into response finish to capture status
  res.on('finish', async () => {
    try {
      const record: Partial<AuditLog> = {
        user_id: (req as any).user?.id || req.headers['x-user-id'] as any || null,
        endpoint: req.originalUrl,
        method: req.method,
        request_body: sanitized,
        response_status: res.statusCode,
      };

      // persist audit log
      if (!(AppDataSource as any).isInitialized) {
        try { await (AppDataSource as any).initialize(); } catch (e) { logger.warn('DataSource init failed for audit: %s', (e as Error).message); }
      }

      try {
        const repo = (AppDataSource as any).getRepository(AuditLog);
        const ent = repo.create(record as any);
        await repo.save(ent);
      } catch (e) {
        logger.warn('Failed to save audit log: %s', (e as Error).message);
      }
    } catch (e) {
      logger.warn('Audit middleware error: %s', (e as Error).message);
    }
  });

  return next();
}
