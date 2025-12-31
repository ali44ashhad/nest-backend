import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Ensure the JWT_SECRET is set
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("CRITICAL ERROR: JWT_SECRET is not defined in environment variables");
  process.exit(1);
}

// Define better interfaces for TypeScript
interface DecodedToken {
  id: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

// Extend Express Request interface to include user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRoles?: string[];
    }
  }
}

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Allow public health and root endpoints to bypass token verification
  if (req.path === "/" || req.path === "/health") {
    next();
    return;
  }
  
  // Try to get token from multiple sources (cookie, header, query)
  const token = 
    req.cookies?.accessToken || 
    req.headers?.authorization?.replace('Bearer ', '') ||
    req.query?.token as string;

  if (!token) {
    res.status(403).json({ message: "No token provided!" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    
    // Add user info to request for use in later middleware or route handlers
    req.userId = decoded.id;
    req.userRoles = decoded.roles;
    
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: "Token expired!" });
      return;
    }
    
    res.status(401).json({ message: "Unauthorized!" });
    return;
  }
};

/**
 * Middleware to check if the user has the required roles
 * @param requiredRoles - Array of roles required to access the route
 */
export const hasRoles = (requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // First verify that the token is valid
    verifyToken(req, res, () => {
      // Check if user has required roles
      if (!req.userRoles) {
        res.status(403).json({ message: "No roles found for user!" });
        return;
      }

      const hasRequiredRole = requiredRoles.some(role => 
        req.userRoles?.includes(role)
      );

      if (!hasRequiredRole) {
        res.status(403).json({ 
          message: "Insufficient privileges to perform this action!" 
        });
        return;
      }

      next();
    });
  };
};