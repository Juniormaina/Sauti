import express, { NextFunction, Request, Response } from 'express';
import { isPermittedOrigin } from './config/env.ts';
import authRoutes from './routes/auth.ts';
import learningRoutes from './routes/learning.ts';
import voiceRoutes from './routes/voice.ts';
import parentRoutes from './routes/parent.ts';
import teacherRoutes from './routes/teacher.ts';
import adminRoutes from './routes/admin.ts';

export function createSautiApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Baseline security headers (keep iframe-compatible: do NOT set X-Frame-Options)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
    next();
  });

  // Cross-origin protection for mutating API requests
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (!isPermittedOrigin(req.headers.origin, req.headers.host, { allowMissingOrigin: true })) {
        return res.status(403).json({ error: 'Request origin is not permitted.' });
      }
    }
    next();
  });

  // Larger JSON body limit ONLY for audio transcription; tight 512kb default everywhere else
  app.use('/api/voice/transcribe', express.json({ limit: '5mb' }));
  app.use(express.json({ limit: '512kb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'sauti-api' });
  });

  // REST API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/learning', learningRoutes);
  app.use('/api/voice', voiceRoutes);
  app.use('/api/parent', parentRoutes);
  app.use('/api/teacher', teacherRoutes);
  app.use('/api/admin', adminRoutes);

  // Sanitized error handler (never leaks stack traces or request secrets)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request payload exceeds size limit.' });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Malformed JSON request body.' });
    }
    return res.status(500).json({ error: 'Unexpected server error.' });
  });

  return app;
}
