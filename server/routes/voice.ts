import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../src/db/index.ts';
import { conversationSessions, voicePracticeSessions } from '../../src/db/schema.ts';
import {
  env,
  isAuthenticatedNonBrowserClient,
  isGeminiConfigured,
  isPermittedOrigin,
  normalizeOriginHeader,
} from '../config/env.ts';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth.ts';
import { createRateLimiter, getClientIp } from '../middleware/rateLimit.ts';
import { sanitizeAiErrorMessage, voiceProvider } from '../services/aiVoiceService.ts';
import { parsePositiveInt, resolveAuthorizedLearner } from '../services/authorizationService.ts';
import {
  ALL_LIVE_MODES,
  evaluateLiveVoiceSafety,
  shouldStoreTranscripts,
} from '../services/childSafetyService.ts';
import { issueLiveTicket } from '../services/liveTicketService.ts';
import { awardSingleAchievement, awardXpAtomically } from '../services/progressService.ts';

const router = Router();

const VALID_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'] as const;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/mp3',
  'audio/mpeg',
  'audio/ogg',
  'audio/mp4',
  'audio/aac',
  'audio/flac',
]);
const MAX_TRANSCRIBE_BYTES = 3 * 1024 * 1024; // 3MB decoded audio cap

const ttsRateLimiter = createRateLimiter({
  name: 'voice-tts',
  windowMs: 10 * 60 * 1000,
  maxRequests: 35,
  keyGenerator: (req) => {
    const authUser = (req as AuthRequest).authUser;
    return authUser ? `user:${authUser.id}` : `ip:${getClientIp(req)}`;
  },
  message: 'Too many speech synthesis requests. Please pause briefly and try again.',
});

const transcribeRateLimiter = createRateLimiter({
  name: 'voice-transcribe',
  windowMs: 10 * 60 * 1000,
  maxRequests: 20,
  keyGenerator: (req) => `user:${(req as AuthRequest).authUser?.id ?? getClientIp(req)}`,
  message: 'Too many transcription requests. Please wait a few minutes.',
});

const aiVoiceCoachRateLimiter = createRateLimiter({
  name: 'voice-ai-coach',
  windowMs: 10 * 60 * 1000,
  maxRequests: 30,
  keyGenerator: (req) => `user:${(req as AuthRequest).authUser?.id ?? getClientIp(req)}`,
  message: 'Too many voice coaching requests. Please wait a moment.',
});

const liveTicketRateLimiter = createRateLimiter({
  name: 'voice-live-ticket',
  windowMs: 10 * 60 * 1000,
  maxRequests: 15,
  keyGenerator: (req) => `user:${(req as AuthRequest).authUser?.id ?? getClientIp(req)}`,
  message: 'Too many Live Voice connection attempts. Please wait a moment.',
});

const ttsSchema = z.object({
  text: z.string().trim().min(1, 'Text is required for speech synthesis.').max(1200),
  voiceName: z.enum(VALID_VOICES).optional(),
  style: z.string().trim().max(120).optional(),
});

const ttsDialogueSchema = z.object({
  lines: z
    .array(
      z.object({
        speaker: z.string().trim().min(1).max(40),
        text: z.string().trim().min(1).max(300),
        voiceName: z.enum(VALID_VOICES).optional(),
        style: z.string().trim().max(120).optional(),
      })
    )
    .min(1, 'Dialogue lines are required.')
    .max(8, 'Dialogue is limited to 8 lines per request.'),
});

const transcribeSchema = z.object({
  audioBase64: z.string().min(16, 'Recorded audio payload is required.').max(4_500_000),
  mimeType: z.string().trim().max(100).optional(),
});

const pronunciationSchema = z.object({
  learnerId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  targetText: z.string().trim().min(1).max(500),
  transcript: z.string().trim().min(1).max(1000),
  durationSeconds: z.number().finite().min(0).max(600).optional(),
});

const speakLogSchema = z.object({
  learnerId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  mode: z.enum(['listen', 'speak', 'pronunciation']).optional(),
  targetText: z.string().trim().max(500).optional().nullable(),
  transcript: z.string().trim().max(2000).optional(),
  feedback: z.string().trim().max(500).optional(),
  durationSeconds: z.number().finite().min(0).max(600).optional(),
});

const conversationSummarySchema = z.object({
  learnerId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  mode: z.string().trim().min(1).max(80).optional(),
  isDemoMode: z.boolean().optional(),
  transcript: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(1500),
        timestamp: z.string().max(64).optional(),
      })
    )
    .max(120)
    .optional(),
  durationSeconds: z.number().finite().min(0).max(3600).optional(),
});

const liveTicketSchema = z.object({
  learnerId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  mode: z.enum(ALL_LIVE_MODES).default('Everyday conversations'),
  voiceName: z.enum(VALID_VOICES).default('Zephyr'),
});

router.get('/status', (_req, res) => {
  res.json({
    geminiConfigured: isGeminiConfigured(),
    models: {
      text: env.models.text,
      tts: env.models.tts,
      transcribe: env.models.transcribe,
      live: env.models.live,
    },
    provider: isGeminiConfigured() ? 'Gemini Voice Provider' : 'Browser Fallback / Demo Mode',
  });
});

router.post('/tts', optionalAuth, ttsRateLimiter, async (req: AuthRequest, res) => {
  try {
    const parsed = ttsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid TTS request.' });
    }
    if (!voiceProvider.isConfigured()) {
      return res.status(503).json({
        error: 'Gemini TTS is not configured on this server. Use browser SpeechSynthesis fallback.',
        fallbackSuggested: true,
      });
    }
    const maxChars = req.authUser ? 1200 : 600;
    const audio = await voiceProvider.synthesizeSpeech(
      parsed.data.text.slice(0, maxChars),
      parsed.data.voiceName,
      parsed.data.style
    );
    return res.json(audio);
  } catch (err: unknown) {
    console.error('TTS error:', (err as any)?.status || 'provider_error');
    return res.status(502).json({
      error: sanitizeAiErrorMessage(err, 'Speech synthesis failed. Use browser SpeechSynthesis fallback.'),
      fallbackSuggested: true,
    });
  }
});

router.post('/tts-dialogue', optionalAuth, ttsRateLimiter, async (req: AuthRequest, res) => {
  try {
    const parsed = ttsDialogueSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dialogue lines are required.' });
    }
    if (!voiceProvider.isConfigured()) {
      return res.status(503).json({
        error: 'Gemini TTS is not configured on this server.',
        fallbackSuggested: true,
      });
    }
    const maxLines = req.authUser ? parsed.data.lines : parsed.data.lines.slice(0, 6);
    const audio = await voiceProvider.synthesizeDialogue(maxLines);
    return res.json(audio);
  } catch (err: unknown) {
    console.error('Multi-speaker TTS error:', (err as any)?.status || 'provider_error');
    return res.status(502).json({
      error: sanitizeAiErrorMessage(err, 'Dialogue synthesis failed.'),
      fallbackSuggested: true,
    });
  }
});

router.post('/transcribe', requireAuth, transcribeRateLimiter, async (req: AuthRequest, res) => {
  try {
    const parsed = transcribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Recorded audio payload is required.' });
    }

    const baseMime = (parsed.data.mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_AUDIO_MIME_TYPES.has(baseMime)) {
      return res.status(400).json({ error: 'Unsupported audio MIME type for transcription.' });
    }

    const compactB64 = parsed.data.audioBase64.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compactB64)) {
      return res.status(400).json({ error: 'Invalid base64 audio payload.' });
    }

    const decodedBytes = Buffer.from(compactB64, 'base64').byteLength;
    if (decodedBytes === 0 || decodedBytes > MAX_TRANSCRIBE_BYTES) {
      return res.status(413).json({ error: 'Audio recording exceeds the maximum allowed size (3 MB).' });
    }

    if (!voiceProvider.isConfigured()) {
      return res.status(503).json({
        error: 'Gemini transcription is unavailable because GEMINI_API_KEY is not configured.',
        transcriptionAvailable: false,
      });
    }

    const transcript = await voiceProvider.transcribeAudio(compactB64, baseMime);
    return res.json({ transcript, transcriptionAvailable: true });
  } catch (err: unknown) {
    console.error('Transcription error:', (err as any)?.status || 'provider_error');
    return res.status(502).json({ error: sanitizeAiErrorMessage(err, 'Unable to transcribe audio.') });
  }
});

router.post('/live-ticket', requireAuth, liveTicketRateLimiter, async (req: AuthRequest, res) => {
  try {
    const allowedOrigins = (req.app?.get('sautiAllowedOrigins') as readonly string[] | undefined) ?? env.allowedOrigins;
    const isNonBrowserAuthed = isAuthenticatedNonBrowserClient(req.headers);

    let boundOrigin: string | null = null;
    if (!isNonBrowserAuthed) {
      if (!isPermittedOrigin(req.headers.origin, { allowMissingOrigin: false, allowedOrigins })) {
        return res.status(403).json({ error: 'Missing or unpermitted Origin header for Live Voice ticket.' });
      }
      boundOrigin = normalizeOriginHeader(req.headers.origin);
      if (!boundOrigin) {
        return res.status(403).json({ error: 'Invalid Origin header for Live Voice ticket.' });
      }
    }

    const parsed = liveTicketSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid Live Voice request.' });
    }

    const access = await resolveAuthorizedLearner(req.authUser!, parsed.data.learnerId);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }
    const { learner, parent } = access;

    const safetyCheck = evaluateLiveVoiceSafety(learner, parent, parsed.data.mode);
    if (!safetyCheck.allowed) {
      return res.status(403).json({
        error: safetyCheck.reason,
        code: safetyCheck.code,
      });
    }

    const issued = issueLiveTicket({
      userId: req.authUser!.id,
      learnerId: learner.id,
      parentId: learner.parentId,
      environment: learner.environment,
      ageRange: learner.ageRange,
      cefrLevel: learner.cefrLevel,
      mode: parsed.data.mode,
      voiceName: parsed.data.voiceName,
      origin: boundOrigin,
      clientType: isNonBrowserAuthed ? 'non_browser' : 'browser',
    });

    return res.status(201).json({
      ticket: issued.ticket,
      expiresAt: issued.expiresAt,
      learnerId: learner.id,
      environment: learner.environment,
      cefrLevel: learner.cefrLevel,
      mode: parsed.data.mode,
    });
  } catch {
    return res.status(500).json({ error: 'Unable to prepare Live Voice session.' });
  }
});

router.post('/pronunciation', requireAuth, aiVoiceCoachRateLimiter, async (req: AuthRequest, res) => {
  try {
    const parsed = pronunciationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Both target text and spoken transcript are required.',
      });
    }

    const access = await resolveAuthorizedLearner(req.authUser!, parsed.data.learnerId, {
      requireGuardianConsentForChild: true,
    });
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { learner, parent } = access;

    const coachResult = await voiceProvider.coachPronunciation(
      parsed.data.targetText,
      parsed.data.transcript,
      learner.environment,
      learner.cefrLevel
    );

    const storeTranscript = shouldStoreTranscripts(learner, parent);
    await db.transaction(async (tx) => {
      await tx.insert(voicePracticeSessions).values({
        learnerId: learner.id,
        mode: 'pronunciation',
        targetText: parsed.data.targetText,
        transcript: storeTranscript ? parsed.data.transcript : null,
        wordComparisonJson: coachResult.comparison,
        feedback: coachResult.guidance,
        durationSeconds: Math.min(600, Math.max(0, Math.round(parsed.data.durationSeconds ?? 0))),
      });

      await awardXpAtomically(tx, learner.id, 20);
      await awardSingleAchievement(tx, learner.id, 'VOICE_PIONEER');
    });

    return res.json(coachResult);
  } catch {
    return res.status(500).json({ error: 'Unable to analyse pronunciation practice.' });
  }
});

router.post('/speak-log', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = speakLogSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid speaking log payload.' });
    }

    const access = await resolveAuthorizedLearner(req.authUser!, parsed.data.learnerId, {
      requireGuardianConsentForChild: true,
    });
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { learner, parent } = access;

    const storeTranscript = shouldStoreTranscripts(learner, parent);
    const saved = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(voicePracticeSessions)
        .values({
          learnerId: learner.id,
          mode: parsed.data.mode || 'speak',
          targetText: parsed.data.targetText || null,
          transcript: storeTranscript ? parsed.data.transcript || '' : null,
          feedback: parsed.data.feedback || 'Spoken recording completed.',
          durationSeconds: Math.min(600, Math.max(0, Math.round(parsed.data.durationSeconds ?? 0))),
        })
        .returning();

      await awardXpAtomically(tx, learner.id, 15);
      await awardSingleAchievement(tx, learner.id, 'VOICE_PIONEER');
      return row;
    });

    return res.status(201).json({ session: saved });
  } catch {
    return res.status(500).json({ error: 'Unable to save speaking practice.' });
  }
});

router.post('/conversation/summary', requireAuth, aiVoiceCoachRateLimiter, async (req: AuthRequest, res) => {
  try {
    const parsed = conversationSummarySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid conversation payload.' });
    }

    const access = await resolveAuthorizedLearner(req.authUser!, parsed.data.learnerId, {
      requireGuardianConsentForChild: true,
    });
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { learner, parent } = access;

    const safeTranscript = (parsed.data.transcript || []).map((t) => ({
      role: t.role,
      text: t.text,
      timestamp: t.timestamp || new Date().toISOString(),
    }));

    const summaryResult = await voiceProvider.summarizeConversation(
      safeTranscript,
      parsed.data.mode || 'Everyday conversations',
      learner.environment,
      learner.cefrLevel
    );

    const storeTranscript = shouldStoreTranscripts(learner, parent);
    const saved = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(conversationSessions)
        .values({
          learnerId: learner.id,
          mode: parsed.data.mode || 'Everyday conversations',
          cefrLevel: learner.cefrLevel,
          environment: learner.environment,
          isDemoMode: Boolean(parsed.data.isDemoMode),
          transcriptJson: storeTranscript ? safeTranscript : [],
          vocabularyNotesJson: summaryResult.vocabularyNotes,
          summary: summaryResult.summary,
          durationSeconds: Math.min(3600, Math.max(0, Math.round(parsed.data.durationSeconds ?? 0))),
        })
        .returning();

      await awardSingleAchievement(tx, learner.id, 'CONVERSATION_BUILDER');
      return row;
    });

    return res.status(201).json({ session: saved, ...summaryResult });
  } catch {
    return res.status(500).json({ error: 'Unable to summarize conversation.' });
  }
});

router.get('/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const access = await resolveAuthorizedLearner(req.authUser!, req.query.learnerId);
    if (!access.ok) {
      const hasRequestedId =
        req.query.learnerId !== undefined &&
        req.query.learnerId !== null &&
        req.query.learnerId !== '';
      if (!hasRequestedId && access.status === 404) {
        return res.json({ practiceSessions: [], conversationSessions: [] });
      }
      return res.status(access.status).json({ error: access.error });
    }
    const { learner, parent } = access;
    const allowTranscripts = shouldStoreTranscripts(learner, parent);

    const practiceSessionsRaw = await db
      .select()
      .from(voicePracticeSessions)
      .where(eq(voicePracticeSessions.learnerId, learner.id))
      .orderBy(desc(voicePracticeSessions.createdAt))
      .limit(25);

    const conversationsRaw = await db
      .select()
      .from(conversationSessions)
      .where(eq(conversationSessions.learnerId, learner.id))
      .orderBy(desc(conversationSessions.createdAt))
      .limit(20);

    return res.json({
      practiceSessions: allowTranscripts
        ? practiceSessionsRaw
        : practiceSessionsRaw.map((p) => ({ ...p, transcript: null })),
      conversationSessions: allowTranscripts
        ? conversationsRaw
        : conversationsRaw.map((c) => ({ ...c, transcriptJson: [] })),
    });
  } catch {
    return res.status(500).json({ error: 'Unable to load voice history.' });
  }
});

router.delete('/history/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid voice session ID.' });

    const access = await resolveAuthorizedLearner(req.authUser!, req.query.learnerId);
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { learner } = access;

    const deleted = await db
      .delete(voicePracticeSessions)
      .where(and(eq(voicePracticeSessions.id, id), eq(voicePracticeSessions.learnerId, learner.id)))
      .returning({ id: voicePracticeSessions.id });

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Voice practice session not found.' });
    }

    return res.json({ deleted: true });
  } catch {
    return res.status(500).json({ error: 'Unable to delete voice session.' });
  }
});

export default router;
