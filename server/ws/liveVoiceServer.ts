import { Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { LiveServerMessage, Modality } from '@google/genai';
import { eq } from 'drizzle-orm';
import { env, isGeminiConfigured } from '../config/env.ts';
import { getGeminiClient } from '../services/aiVoiceService.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { db } from '../../src/db/index.ts';
import { learnerProfiles, parentProfiles } from '../../src/db/schema.ts';

function buildLiveSystemInstruction(
  mode: string,
  environment: string,
  cefrLevel: string
): string {
  const isYoungChild = environment === 'little_voices' || environment === 'young_explorers';
  const safetyGuard = isYoungChild
    ? 'SAFETY RULE: The learner is a child. Keep all topics strictly educational, gentle, concrete (animals, colours, school, family, everyday objects). Never discuss mature topics, personal details, or unrestricted chat.'
    : 'Keep conversation encouraging, respectful, and tailored to practical English growth.';

  return `You are SAUTI, a warm, patient, voice-first English learning companion.
Conversation mode: ${mode}.
Learner environment: ${environment}.
CEFR proficiency level: ${cefrLevel}.
${safetyGuard}
Speak clearly and naturally. Keep turns concise (1-3 sentences for beginners, 2-4 for intermediate/advanced). Gently model better phrasing without interrupting the learner's confidence.`;
}

export function attachLiveVoiceWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname !== '/ws/live') return;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (clientWs: WebSocket, request) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const token = reqUrl.searchParams.get('token') || '';
    const mode = reqUrl.searchParams.get('mode') || 'Everyday conversations';
    const environment = reqUrl.searchParams.get('environment') || 'young_adults';
    const cefrLevel = reqUrl.searchParams.get('cefrLevel') || 'A2';
    const voiceName = reqUrl.searchParams.get('voiceName') || 'Zephyr';

    const authUser = token ? await authenticateToken(token) : null;
    if (!authUser) {
      clientWs.send(JSON.stringify({ type: 'error', message: 'Authentication required for Live Voice session.' }));
      clientWs.close();
      return;
    }

    // Child safety check: young children require parent approval or guided-only mode
    if (environment === 'little_voices') {
      const [learner] = await db
        .select()
        .from(learnerProfiles)
        .where(eq(learnerProfiles.userId, authUser.id))
        .limit(1);

      if (learner?.parentId) {
        const [parent] = await db
          .select()
          .from(parentProfiles)
          .where(eq(parentProfiles.id, learner.parentId))
          .limit(1);
        if (parent && !parent.allowAiLiveForChildren) {
          clientWs.send(
            JSON.stringify({
              type: 'safety_restricted',
              message:
                'Free AI Live conversation is paused by parent privacy settings for Little Voices. Use Listen & Learn or Speak & Practise instead.',
            })
          );
          clientWs.close();
          return;
        }
      }
    }

    const ai = getGeminiClient();
    if (!ai || !isGeminiConfigured()) {
      clientWs.send(
        JSON.stringify({
          type: 'demo_mode',
          message:
            'Gemini API key is not configured on the server. Switching to clearly labelled local Demo Mode.',
        })
      );
      clientWs.close();
      return;
    }

    let session: any = null;
    try {
      const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
      const selectedVoice = validVoices.includes(voiceName) ? voiceName : 'Zephyr';

      session = await ai.live.connect({
        model: env.models.live,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: buildLiveSystemInstruction(mode, environment, cefrLevel),
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'ready', model: env.models.live }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'input_transcript',
                  text: content.inputTranscription.text,
                })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({
                  type: 'output_transcript',
                  text: content.outputTranscription.text,
                })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(
                  JSON.stringify({
                    type: 'audio',
                    audio: part.inlineData.data,
                  })
                );
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ type: 'turn_complete' }));
            }
          },
          onerror: (err: any) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message: err?.message || 'Live voice session encountered an error.',
                })
              );
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'closed' }));
              clientWs.close();
            }
          },
        },
      });
    } catch (err: any) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: err?.message || 'Unable to establish Gemini Live API connection.',
        })
      );
      clientWs.close();
      return;
    }

    clientWs.on('message', (rawData) => {
      if (!session) return;
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.text) {
          session.sendRealtimeInput({ text: msg.text });
        }
      } catch {
        // Ignore malformed client frames
      }
    });

    clientWs.on('close', () => {
      try {
        session?.close();
      } catch {
        // Ignore close cleanup errors
      }
    });
  });
}
