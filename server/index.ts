/**
 * SENTINEL.AI Server - Modular Entry Point
 * PHASE 4: Refactored server architecture with modular design
 *
 * This is the new modular entry point that replaces the monolithic server.js
 * TODO: Incrementally migrate endpoints from server.js to this modular structure
 */

import express, { Express, Request, Response } from 'express';
import { validateServerEnv, type ServerConfig } from './config/env.js';
import { setupMiddleware } from './config/middleware.js';
import { initializeResourceManager } from './services/resources.js';
import { createHealthRouter } from './modules/health/router.js';
import { logger } from '../services/logger.js';

/**
 * Initialize and start the Express server
 */
async function startServer(): Promise<{ app: Express; config: ServerConfig }> {
  try {
    // Load and validate configuration
    const config = validateServerEnv();
    logger.info('SERVER', `Environment: ${config.isProduction ? 'production' : 'development'}`);
    logger.info('SERVER', `Electron: ${config.isElectron ? 'yes' : 'no'}`);

    // Create Express app
    const app = express();

    // Setup middleware (CORS, security headers, rate limiting, etc.)
    setupMiddleware(app, config);
    logger.info('SERVER', 'Middleware configured');

    // Initialize resource manager for tool paths
    const resourceManager = initializeResourceManager(config);
    logger.info('SERVER', 'Resource manager initialized');

    // Mount modular routers
    // Health checks
    app.use(createHealthRouter(config));
    logger.info('SERVER', 'Health module mounted');

    // Import other module routers
    const { createSecurityRouter } = await import('./modules/security/router.js');
    const { createTranscodingRouter } = await import('./modules/transcoding/router.js');
    const { createOCRRouter } = await import('./modules/ocr/router.js');
    const { createAIRouter } = await import('./modules/ai/router.js');
    const { createReportsRouter } = await import('./modules/reports/router.js');
    const { createCamerasRouter } = await import('./modules/cameras/router.js');
    const { createEvidenceRouter } = await import('./modules/evidence/router.js');

    // Mount all modules
    app.use(createSecurityRouter(config));
    app.use(createTranscodingRouter(config));
    app.use(createOCRRouter(config));
    app.use(createAIRouter(config));
    app.use(createReportsRouter(config));
    app.use(createCamerasRouter(config));
    app.use(createEvidenceRouter(config));

    logger.info('SERVER', 'All service modules mounted (7/7)');

    // Fallback for routes not yet refactored: proxy to old server.js
    app.use((req: Request, res: Response) => {
      // This is a temporary endpoint to indicate which routes need refactoring
      if (req.path.startsWith('/api/')) {
        res.status(501).json({
          error: 'Endpoint not yet migrated to modular architecture',
          path: req.path,
          status: 'TODO: PHASE 4 migration pending',
        });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    });

    // Error handling middleware
    app.use((error: any, req: Request, res: Response) => {
      logger.error('SERVER', 'Unhandled error', error);
      res.status(500).json({
        error: 'Internal server error',
        message: config.isProduction ? undefined : error.message,
      });
    });

    return { app, config };
  } catch (error) {
    logger.error('SERVER', 'Failed to initialize server', error);
    throw error;
  }
}

/**
 * Start listening on configured port
 */
async function listen(app: Express, config: ServerConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(config.port, '0.0.0.0', () => {
        logger.success(
          'SERVER',
          `✓ Server listening on port ${config.port} (${config.isProduction ? 'production' : 'development'})`
        );
        resolve();
      });

      server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logger.error('SERVER', `Port ${config.port} already in use`);
        }
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Main entry point - export for use as module or direct execution
export const main = async () => {
  try {
    const { app, config } = await startServer();
    await listen(app, config);
  } catch (error) {
    logger.error('SERVER', 'Fatal error', error);
    process.exit(1);
  }
};

// Run if this is the entry point
if (typeof require !== 'undefined') {
  const path = require('path');
  const currentFile = path.basename(__filename);
  const mainModule = path.basename(process.mainModule?.filename || '');
  if (currentFile === mainModule || process.argv[1]?.includes(currentFile)) {
    main().catch((error) => {
      logger.error('SERVER', 'Failed to start', error);
      process.exit(1);
    });
  }
}

export { startServer, listen };
