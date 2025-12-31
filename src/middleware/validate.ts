import { Request, Response, NextFunction } from 'express';
import { ValidationChain, validationResult } from 'express-validator';
import logger from '../utils/logger';

/**
 * Middleware factory to validate incoming request data
 * @param validations - Array of express-validator validation chains
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Execute all validations
      await Promise.all(validations.map(validation => validation.run(req)));
      
      // Check for validation errors
      const errors = validationResult(req);
      
      if (errors.isEmpty()) {
        next();
        return;
      }
      
      // Log validation errors
      logger.warn({ 
        path: req.path, 
        method: req.method, 
        body: req.body,
        query: req.query, 
        params: req.params,
        errors: errors.array() 
      }, 'Request validation failed');

      // Return validation errors to client
      res.status(400).json({ 
        errors: errors.array().map(error => ({
          field: error.type === 'field' ? error.path : String(error.type),
          message: error.msg
        }))
      });
    } catch (err) {
      next(err);
    }
  };
};