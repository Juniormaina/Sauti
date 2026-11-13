import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  achievements,
  conversationSessions,
  learnerAchievements,
  learnerProfiles,
  voicePracticeSessions,
} from '../../src/db/schema.ts';
import { env, isGeminiConfigured } from '../config/env.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { voiceProvider } from '../services/aiVoiceService.ts';

const router = Router();

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

router.post('/tts', async (req, res) => {
  try {
    const { text, voiceName, style } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for speech synthesis.' });
    }
    if (!voiceProvider.isConfigured()) {
      return res.status(503).json({
        error: 'Gemini TTS is not configured on this server. Use browser SpeechSynthesis fallback.',
        fallbackSuggested: true,
      });
    }
    const audio = await voiceProvider.synthesizeSpeech(text.slice(0, 1200), voiceName, style);
    return res.json(audio);
  } catch (err: any) {
    console.error('TTS error:', err);
    return res.status(502).json({
      error: err?.message || 'Speech synthesis failed.',
      fallbackSuggested: true,
    });
  }
});

router.post('/tts-dialogue', async (req, res) => {
  try {
    const { lines } = req.body || {};
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Dialogue lines are required.' });
    }
    if (!voiceProvider.isConfigured()) {
      return res.status(503).json({
        error: 'Gemini TTS is not configured on this server.',
        fallbackSuggested: true,
      });
    }
    const audio = await voiceProvider.synthesizeDialogue(lines);
    return res.json(audio);
  } catch (err: any) {
    console.error('Multi-speaker TTS error:', err);
    return res.status(502).json({ error: err?.message || 'Dialogue synthesis failed.', fallbackSuggested: true });
  }
});

router.post('/transcribe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { audioBase64, mimeType } = req.body || {};
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'Recorded audio payload is required.' });
    }
    if (!voiceProvider.isConfigured()) {
      return res.status(503).json({
        error: 'Gemini transcription is unavailable because GEMINI_API_KEY is not configured.',
        transcriptionAvailable: false,
      });
    }
    const transcript = await voiceProvider.transcribeAudio(audioBase64, mimeType || 'audio/webm');
    return res.json({ transcript, transcriptionAvailable: true });
  } catch (err: any) {
    console.error('Transcription error:', err);
    return res.status(502).json({ error: err?.message || 'Unable to transcribe audio.' });
  }
});

router.post('/pronunciation', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { targetText, transcript, durationSeconds } = req.body || {};
    if (!targetText || !transcript) {
      return res.status(400).json({ error: 'Both target text and spoken transcript are required.' });
    }

    const [learner] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.userId, req.authUser!.id))
      .limit(1);

    const coachResult = await voiceProvider.coachPronunciation(
      targetText,
      transcript,
      learner?.environment || 'young_adults',
      learner?.cefrLevel || 'A2'
    );

    if (learner) {
      await db.insert(voicePracticeSessions).values({
        learnerId: learner.id,
        mode: 'pronunciation',
        targetText,
        transcript,
        wordComparisonJson: coachResult.comparison,
        feedback: coachResult.guidance,
        durationSeconds: Number(durationSeconds || 0),
      });

      await db
        .update(learnerProfiles)
        .set({ xp: learner.xp + 20, updatedAt: new Date() })
        .where(eq(learnerProfiles.id, learner.id));
    }

    return res.json(coachResult);
  } catch (err: any) {
    console.error('Pronunciation coach error:', err);
    return res.status(500).json({ error: 'Unable to analyse pronunciation practice.' });
  }
});

router.post('/speak-log', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { mode, targetText, transcript, feedback, durationSeconds } = req.body || {};
    const [learner] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.userId, req.authUser!.id))
      .limit(1);

    if (!learner) return res.status(404).json({ error: 'Learner profile not found.' });

    const [saved] = await db
      .insert(voicePracticeSessions)
      .values({
        learnerId: learner.id,
        mode: mode || 'speak',
        targetText: targetText || null,
        transcript: transcript || '',
        feedback: feedback || 'Spoken recording completed.',
        durationSeconds: Number(durationSeconds || 0),
      })
      .returning();

    await db
      .update(learnerProfiles)
      .set({ xp: learner.xp + 15, updatedAt: new Date() })
      .where(eq(learnerProfiles.id, learner.id));

    const [voiceAch] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.code, 'VOICE_PIONEER'))
      .limit(1);
    if (voiceAch) {
      await db
        .insert(learnerAchievements)
        .values({ learnerId: learner.id, achievementId: voiceAch.id })
        .onConflictDoNothing();
    }

    return res.status(201).json({ session: saved });
  } catch (err: any) {
    console.error('Speak log error:', err);
    return res.status(500).json({ error: 'Unable to save speaking practice.' });
  }
});

router.post('/conversation/summary', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { mode, isDemoMode, transcript, durationSeconds } = req.body || {};
    const [learner] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.userId, req.authUser!.id))
      .limit(1);

    if (!learner) return res.status(404).json({ error: 'Learner profile not found.' });

    const safeTranscript = Array.isArray(transcript) ? transcript : [];
    const summaryResult = await voiceProvider.summarizeConversation(
      safeTranscript,
      mode || 'Everyday conversations',
      learner.environment,
      learner.cefrLevel
    );

    const [saved] = await db
      .insert(conversationSessions)
      .values({
        learnerId: learner.id,
        mode: mode || 'Everyday conversations',
        cefrLevel: learner.cefrLevel,
        environment: learner.environment,
        isDemoMode: Boolean(isDemoMode),
        transcriptJson: safeTranscript,
        vocabularyNotesJson: summaryResult.vocabularyNotes,
        summary: summaryResult.summary,
        durationSeconds: Number(durationSeconds || 0),
      })
      .returning();

    const [convAch] = await db
      .select()
      .from(achievements)
      .where(eq(achievements.code, 'CONVERSATION_BUILDER'))
      .limit(1);
    if (convAch) {
      await db
        .insert(learnerAchievements)
        .values({ learnerId: learner.id, achievementId: convAch.id })
        .onConflictDoNothing();
    }

    return res.status(201).json({ session: saved, ...summaryResult });
  } catch (err: any) {
    console.error('Conversation summary error:', err);
    return res.status(500).json({ error: 'Unable to summarize conversation.' });
  }
});

router.get('/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const [learner] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.userId, req.authUser!.id))
      .limit(1);

    if (!learner) return res.json({ practiceSessions: [], conversationSessions: [] });

    const practiceSessions = await db
      .select()
      .from(voicePracticeSessions)
      .where(eq(voicePracticeSessions.learnerId, learner.id))
      .orderBy(desc(voicePracticeSessions.createdAt))
      .limit(25);

    const conversations = await db
      .select()
      .from(conversationSessions)
      .where(eq(conversationSessions.learnerId, learner.id))
      .orderBy(desc(conversationSessions.createdAt))
      .limit(20);

    return res.json({ practiceSessions, conversationSessions: conversations });
  } catch (err: any) {
    console.error('Voice history error:', err);
    return res.status(500).json({ error: 'Unable to load voice history.' });
  }
});

router.delete('/history/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [learner] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.userId, req.authUser!.id))
      .limit(1);

    if (!learner) return res.status(404).json({ error: 'Learner not found.' });

    await db
      .delete(voicePracticeSessions)
      .where(and(eq(voicePracticeSessions.id, id), eq(voicePracticeSessions.learnerId, learner.id)));

    return res.json({ deleted: true });
  } catch (err: any) {
    console.error('Delete voice session error:', err);
    return res.status(500).json({ error: 'Unable to delete voice session.' });
  }
});

export default router;
