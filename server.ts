import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { env } from './server/config/env.ts';
import authRoutes from './server/routes/auth.ts';
import learningRoutes from './server/routes/learning.ts';
import voiceRoutes from './server/routes/voice.ts';
import parentRoutes from './server/routes/parent.ts';
import teacherRoutes from './server/routes/teacher.ts';
import adminRoutes from './server/routes/admin.ts';
import { attachLiveVoiceWebSocket } from './server/ws/liveVoiceServer.ts';

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '15mb' }));

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

  // WebSocket bridge for Gemini Live API
  attachLiveVoiceWebSocket(server);

  if (env.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(env.port, '0.0.0.0', () => {
    console.log(`SAUTI server running on http://0.0.0.0:${env.port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SAUTI server:', err);
  process.exit(1);
});
