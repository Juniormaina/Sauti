import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { assertAiConfigurationOnStartup, env } from './server/config/env.ts';
import { createSautiApp } from './server/app.ts';
import { attachLiveVoiceWebSocket } from './server/ws/liveVoiceServer.ts';

async function startServer() {
  assertAiConfigurationOnStartup();
  const app = createSautiApp();
  const server = http.createServer(app);

  // WebSocket bridge for Gemini Live API
  attachLiveVoiceWebSocket(server);

  if (env.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
        ws: {
          server,
          path: '/__vite_ws',
        },
        allowedHosts: true,
      },
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
  console.error('Failed to start SAUTI server:', err instanceof Error ? err.message : 'startup_error');
  process.exit(1);
});
