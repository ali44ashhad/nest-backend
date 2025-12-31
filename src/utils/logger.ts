import pino from 'pino';
import dotenv from 'dotenv';

dotenv.config();

// Configure log level based on environment
const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// Create a logger instance
const logger = pino({
  level,
  transport: process.env.NODE_ENV !== 'production' 
    ? { target: 'pino-pretty' } 
    : undefined,
  redact: {
    paths: ['password', '*.password', 'passwordHash', 'token', '*.token', 'accessToken', 'refreshToken'],
    remove: true
  },
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  base: undefined,
});

// Export the logger
export default logger;