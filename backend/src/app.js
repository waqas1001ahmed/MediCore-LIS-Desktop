import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { config } from './config.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    helmet({
      // The API also serves uploaded images that are embedded cross-origin
      // from the dev server and the print preview.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) return callback(null, true);
        if (!config.isProduction && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/i.test(origin)) {
          return callback(null, true);
        }
        // Allow any *.MediCoreLIS.live preview origin.
        if (/^https?:\/\/[a-z0-9-]+\.monkeycode-ai\.live$/i.test(origin)) return callback(null, true);
        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      credentials: true,
    }),
  );

  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'labms-api', health: '/api/health' });
  });

  app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }));

  app.use('/api', apiRoutes);

  if (config.staticDir) {
    app.use(express.static(config.staticDir));
    app.get('*', (req, res, next) => {
      if (req.path === '/api' || req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
        return next();
      }
      return res.sendFile(path.join(config.staticDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();

export default app;
