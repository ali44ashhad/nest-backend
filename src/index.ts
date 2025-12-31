import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import dotenv from "dotenv";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes";
import compilerRoutes from "./routes/compiler.routes";
import projectRoutes from "./routes/project.routes";
import userProfileRoutes from "./routes/userProfile.routes";
import analyticsRoutes from "./routes/analytics.routes";
import { requestLogger, errorLogger } from "./utils/httpLogger";
import logger from "./utils/logger";

// Load environment variables
dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

logger.info(`Starting application in ${process.env.NODE_ENV} mode`);

// Request logging middleware (early in the middleware chain)
app.use(requestLogger);

// Enhanced security with helmet
app.use(helmet());

// Rate limiting to protect against brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 15 minutes",
  skip: (req) => req.path.startsWith("/api/analytics"), // allow analytics routes to bypass rate limiting
});
app.use(limiter);

// CORS configuration from environment variables
const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [
  "http://localhost:5173",
  "https://main.d1tyz4k21sbvr8.amplifyapp.com",
  "https://nestatoys.com"
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests that don't have an origin (e.g., server-to-server)
      if (!origin) return callback(null, true);

      // If the request origin is in our list of allowed origins, allow it
      if (corsOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      
      // Otherwise, block the request
      return callback(new Error("This origin is not allowed by the CORS policy."));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "5mb" })); // Increase payload size limit for code
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(cookieParser());

// Public health check route
app.get("/health", (req, res) => {
  // Format timestamp in IST (UTC+5:30)
  const now = new Date();
  const istOptions = { 
    timeZone: 'Asia/Kolkata',
    timeZoneName: 'short' as const
  };
  const istTimestamp = now.toLocaleString('en-IN', istOptions);
  
  // Format uptime in hours:minutes:seconds
  const uptimeInSeconds = process.uptime();
  const hours = Math.floor(uptimeInSeconds / 3600);
  const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeInSeconds % 60);
  const formattedUptime = `${hours}h ${minutes}m ${seconds}s`;
  
  res.json({
    status: "ok",
    timestamp: istTimestamp,
    uptime: formattedUptime,
    environment: process.env.NODE_ENV
  });
});

// Mount application routes
app.use(authRoutes);
app.use(userRoutes);
app.use(compilerRoutes);
app.use(projectRoutes);
app.use(userProfileRoutes);
app.use(analyticsRoutes);

// Global error logging middleware
app.use(errorLogger);

// Global error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Resource not found' });
});

// Start server
const server = app.listen(port, "0.0.0.0", () => {
  logger.info(`Server is running on port ${port} in ${process.env.NODE_ENV} mode`);
});

// Graceful shutdown
const gracefulShutdown = () => {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed');
    // Close database connections
    import('./db').then(({ default: pool }) => {
      pool.end().then(() => {
        logger.info('Database connections closed');
        process.exit(0);
      });
    }).catch((err) => {
      logger.error({ err }, 'Error closing DB connections');
      process.exit(1);
    });
  });
  
  // Force close if graceful shutdown fails
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);