import { IncomingMessage, Server as HttpServer } from 'node:http';
import { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { LiveServerMessage, Modality } from '@google/genai';
import { eq } from 'drizzle-orm';
import { env, isGeminiConfigured, isPermittedOrigin } from '../config/env.ts';
import { getGeminiClient, sanitizeAiErrorMessage } from '../services/aiVoiceService.ts';
import { db } from '../../src/db/index.ts';
import { learnerProfiles, parentProfiles } from '../../src/db/schema.ts';
import { buildAgeSafetyPromptGuard, evaluateLiveVoiceSafety } from '../services/childSafetyService.ts';
import {
  ActiveLiveConnection,
  consumeLiveTicket,
  countActiveConnectionsForIp,
  countActiveConnectionsForUser,
  LiveTicketPayload,
  registerActiveLiveConnection,
  unregisterActiveLiveConnection,
} from '../services/liveTicketService.ts';

const MAX_CONCURRENT_PER_USER = 2;
const MAX_CONCURRENT_PER_IP = 5;
const MAX_WS_PAYLOAD_BYTES = 256 * 1024;
const MAX_AUDIO_BASE64_CHARS = 131_072;
const MAX_TEXT_TURN_CHARS = 2000;
const SESSION_MAX_DURATION_MS = 15 * 60 * 1000;
const SESSION_IDLE_TIMEOUT_MS = 3 * 60 * 1000;
const SAFETY_RECHECK_INTERVAL_MS = 30 * 1000;

function rejectUpgrade(socket: Duplex, statusCode: number, reason: string) {
  const statusText =
    statusCode === 401
      ? 'Unauthorized'
      : statusCode === 403
      ? 'Forbidden'
      : statusCode === 429
      ? 'Too Many Requests'
      : 'Bad Request';
  try {
    socket.write(
      `HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${reason}`
    );
  } catch {
    // Ignore socket write errors on teardown
  }
  socket.destroy();
}

function getUpgradeClientIp(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  return request.socket?.remoteAddress || 'unknown';
}

function buildLiveSystemInstruction(
  mode: string,
  environment: string,
  ageRange: string,
  cefrLevel: string
): string {
  const safetyGuard = buildAgeSafetyPromptGuard(environment, ageRange);
  return `You are SAUTI, a warm, patient, voice-first English learning companion.
Conversation mode: ${mode}.
Learner environment: ${environment}.
CEFR proficiency level: ${cefrLevel}.
${safetyGuard}
Speak clearly and naturally. Keep turns concise (1-3 sentences for beginners, 2-4 for intermediate/advanced). Gently model better phrasing without interrupting the learner's confidence.`;
}

interface AuthedUpgradeContext {
  ticket: LiveTicketPayload;
  learner: typeof learnerProfiles.$inferSelect;
  parent: typeof parentProfiles.$inferSelect | null;
  ip: string;
}

export function attachLiveVoiceWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_WS_PAYLOAD_BYTES,
  });

  server.on('upgrade', async (request, socket, head) => {
    let reqUrl: URL;
    try {
      reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    } catch {
      rejectUpgrade(socket, 400, 'Malformed WebSocket URL');
      return;
    }

    if (reqUrl.pathname !== '/ws/live') return;

    // 1. Validate Origin before upgrading
    if (!isPermittedOrigin(request.headers.origin, request.headers.host, { allowMissingOrigin: true })) {
      rejectUpgrade(socket, 403, 'Origin not permitted');
      return;
    }

    // 2. Reject legacy query-param long-lived tokens or missing ticket before upgrade
    if (reqUrl.searchParams.has('token')) {
      rejectUpgrade(socket, 401, 'Bearer tokens in WebSocket URL are not permitted. Use a single-use ticket.');
      return;
    }

    const rawTicket = reqUrl.searchParams.get('ticket');
    const requestOrigin =
      typeof request.headers.origin === 'string' && request.headers.origin.length > 0
        ? request.headers.origin
        : null;

    const ticket = consumeLiveTicket(rawTicket, requestOrigin);
    if (!ticket) {
      rejectUpgrade(socket, 401, 'Invalid, expired, or already used Live Voice ticket.');
      return;
    }

    // 3. Re-verify learner, parent consent, and age-safety controls from DB before upgrade
    try {
      const [learner] = await db
        .select()
        .from(learnerProfiles)
        .where(eq(learnerProfiles.id, ticket.learnerId))
        .limit(1);

      if (!learner) {
        rejectUpgrade(socket, 403, 'Learner profile unavailable.');
        return;
      }

      let parent: typeof parentProfiles.$inferSelect | null = null;
      if (learner.parentId !== null) {
        const [parentRow] = await db
          .select()
          .from(parentProfiles)
          .where(eq(parentProfiles.id, learner.parentId))
          .limit(1);
        parent = parentRow || null;
      }

      const safety = evaluateLiveVoiceSafety(learner, parent, ticket.mode);
      if (!safety.allowed) {
        rejectUpgrade(socket, 403, safety.reason);
        return;
      }

      // 4. Enforce connection limits per user and per IP before upgrade
      const ip = getUpgradeClientIp(request);
      if (
        countActiveConnectionsForUser(ticket.userId) >= MAX_CONCURRENT_PER_USER ||
        countActiveConnectionsForIp(ip) >= MAX_CONCURRENT_PER_IP
      ) {
        rejectUpgrade(socket, 429, 'Too many concurrent Live Voice sessions.');
        return;
      }

      const ctx: AuthedUpgradeContext = { ticket, learner, parent, ip };
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, ctx);
      });
    } catch {
      rejectUpgrade(socket, 500, 'Unable to verify Live Voice session.');
    }
  });

  wss.on(
    'connection',
    async (clientWs: WebSocket, _request: IncomingMessage, ctx?: AuthedUpgradeContext) => {
      if (!ctx) {
        clientWs.close(1008, 'Missing session context');
        return;
      }

      const { ticket, learner, ip } = ctx;
      let session: any = null;
      let cleanedUp = false;
      let maxDurationTimer: NodeJS.Timeout | null = null;
      let idleTimer: NodeJS.Timeout | null = null;
      let safetyRecheckTimer: NodeJS.Timeout | null = null;

      const sendJson = (payload: Record<string, unknown>) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify(payload));
        }
      };

      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        if (maxDurationTimer) clearTimeout(maxDurationTimer);
        if (idleTimer) clearTimeout(idleTimer);
        if (safetyRecheckTimer) clearInterval(safetyRecheckTimer);
        unregisterActiveLiveConnection(activeConn);
        try {
          session?.close();
        } catch {
          // Ignore close cleanup errors
        }
        session = null;
      };

      const activeConn: ActiveLiveConnection = {
        ws: clientWs,
        userId: ticket.userId,
        learnerId: learner.id,
        parentId: learner.parentId,
        ip,
        closeWithRestriction: (reason: string) => {
          sendJson({ type: 'safety_restricted', message: reason });
          cleanup();
          if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
            clientWs.close(1008, 'Restricted by guardian settings');
          }
        },
      };

      registerActiveLiveConnection(activeConn);

      const resetIdleTimer = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
          sendJson({ type: 'closed', message: 'Live session closed due to inactivity.' });
          cleanup();
          if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1000, 'Idle timeout');
        }, SESSION_IDLE_TIMEOUT_MS);
      };

      resetIdleTimer();

      maxDurationTimer = setTimeout(() => {
        sendJson({ type: 'closed', message: 'Live session reached its 15-minute limit.' });
        cleanup();
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close(1000, 'Session duration limit');
      }, SESSION_MAX_DURATION_MS);

      // Periodic DB safety check so even external parental setting updates end active minor sessions.
      safetyRecheckTimer = setInterval(async () => {
        try {
          const [freshLearner] = await db
            .select()
            .from(learnerProfiles)
            .where(eq(learnerProfiles.id, learner.id))
            .limit(1);
          if (!freshLearner) {
            activeConn.closeWithRestriction('Learner profile no longer active.');
            return;
          }
          let freshParent: typeof parentProfiles.$inferSelect | null = null;
          if (freshLearner.parentId !== null) {
            const [p] = await db
              .select()
              .from(parentProfiles)
              .where(eq(parentProfiles.id, freshLearner.parentId))
              .limit(1);
            freshParent = p || null;
          }
          const check = evaluateLiveVoiceSafety(freshLearner, freshParent, ticket.mode);
          if (!check.allowed) {
            activeConn.closeWithRestriction(check.reason);
          }
        } catch {
          // Ignore transient poll errors; active revocation hook handles direct changes immediately
        }
      }, SAFETY_RECHECK_INTERVAL_MS);

      clientWs.on('close', cleanup);
      clientWs.on('error', cleanup);

      const ai = getGeminiClient();
      if (!ai || !isGeminiConfigured()) {
        sendJson({
          type: 'demo_mode',
          message:
            'Gemini API key is not configured on the server. Switching to clearly labelled local Demo Mode.',
        });
        cleanup();
        clientWs.close(1000, 'Demo mode');
        return;
      }

      try {
        const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
        const selectedVoice = validVoices.includes(ticket.voiceName) ? ticket.voiceName : 'Zephyr';

        session = await ai.live.connect({
          model: env.models.live,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: buildLiveSystemInstruction(
              ticket.mode,
              learner.environment,
              learner.ageRange,
              learner.cefrLevel
            ),
          },
          callbacks: {
            onopen: () => {
              sendJson({ type: 'ready', model: env.models.live });
            },
            onmessage: (message: LiveServerMessage) => {
              if (clientWs.readyState !== WebSocket.OPEN) return;
              const content = message.serverContent;
              if (content?.inputTranscription?.text) {
                sendJson({ type: 'input_transcript', text: content.inputTranscription.text });
              }
              if (content?.outputTranscription?.text) {
                sendJson({ type: 'output_transcript', text: content.outputTranscription.text });
              }
              for (const part of content?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  sendJson({ type: 'audio', audio: part.inlineData.data });
                }
              }
              if (content?.interrupted) {
                sendJson({ type: 'interrupted' });
              }
              if (content?.turnComplete) {
                sendJson({ type: 'turn_complete' });
              }
            },
            onerror: (err: unknown) => {
              sendJson({
                type: 'error',
                message: sanitizeAiErrorMessage(err, 'Live voice session encountered an error.'),
              });
            },
            onclose: () => {
              sendJson({ type: 'closed' });
              cleanup();
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.close();
              }
            },
          },
        });
      } catch (err: unknown) {
        sendJson({
          type: 'error',
          message: sanitizeAiErrorMessage(err, 'Unable to establish Gemini Live API connection.'),
        });
        cleanup();
        clientWs.close();
        return;
      }

      clientWs.on('message', (rawData) => {
        if (!session) return;
        resetIdleTimer();
        try {
          const rawStr = rawData.toString();
          if (rawStr.length > MAX_WS_PAYLOAD_BYTES) return;
          const msg = JSON.parse(rawStr);
          if (typeof msg.audio === 'string' && msg.audio.length > 0 && msg.audio.length <= MAX_AUDIO_BASE64_CHARS) {
            session.sendRealtimeInput({
              audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          } else if (typeof msg.text === 'string') {
            const trimmed = msg.text.trim();
            if (trimmed.length > 0 && trimmed.length <= MAX_TEXT_TURN_CHARS) {
              session.sendRealtimeInput({ text: trimmed });
            }
          }
        } catch {
          // Ignore malformed client frames
        }
      });
    }
  );
}
