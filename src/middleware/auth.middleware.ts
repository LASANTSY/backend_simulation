// Authentication middleware disabled. Calls next() without enforcing auth.
import { Request, Response, NextFunction } from 'express';

export function authMiddleware(_req: Request, _res: Response, next: NextFunction) {
  // Intentionally allow all requests through.
  next();
}

export default authMiddleware;
