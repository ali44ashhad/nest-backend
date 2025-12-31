import { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import logger from './logger';

// Extend Express Request interface to include startTime
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
    }
  }
}

/**
 * Custom HTTP logger middleware for Express that uses our configured pino logger
 */

// Export a request handler middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Add request start time for calculating response time
  req.startTime = Date.now();
  
  // Log request
  logger.info({
    req: {
      method: req.method,
      url: req.url,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'accept': req.headers['accept'],
        'x-forwarded-for': req.headers['x-forwarded-for'] || req.ip,
      }
    }
  }, `Request received: ${req.method} ${req.url}`);
  
  // Log response on finish
  res.on('finish', () => {
    const responseTime = Date.now() - (req.startTime || Date.now());
    const logLevel = res.statusCode >= 500 ? 'error' : 
                     res.statusCode >= 400 ? 'warn' : 'info';
    
    // Use dynamic method access for the log level
    (logger[logLevel as keyof typeof logger] as pino.LogFn)({
      res: {
        statusCode: res.statusCode,
        responseTime,
        headers: {
          'content-type': res.getHeader('content-type'),
          'content-length': res.getHeader('content-length')
        }
      }
    }, `Response sent: ${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`);
  });
  
  next();
};

// Error logger middleware
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    err: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    req: {
      method: req.method,
      url: req.url,
      params: req.params,
      query: req.query,
      body: req.body,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
        'accept': req.headers['accept'],
      }
    }
  }, `Error: ${err.message}`);
  
  next(err);
};