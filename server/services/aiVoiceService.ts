import { GoogleGenAI, Type } from '@google/genai';
import {
  AiCapability,
  env,
  getConfiguredModel,
  isCapabilityConfigured,
  isGeminiApiKeySet,
  isGeminiConfigured,
  requireConfiguredModel,
} from '../config/env.ts';
import { buildAgeSafetyPromptGuard } from './childSafetyService.ts';

export interface WordComparisonItem {
  word: string;
  status: 'matched' | 'missing' | 'substituted';
}

export interface PronunciationFeedbackResult {
  targetText: string;
  transcript: string;
  comparison: WordComparisonItem[];
  matchedRatio: number;
  guidance: string;
  phoneticDisclaimer: string;
  aiPowered: boolean;
}

export interface IVoiceProvider {
  isConfigured(): boolean;
  isCapabilityConfigured(capability: AiCapability): boolean;
  synthesizeSpeech(text: string, voiceName?: string, style?: string): Promise<{ audioBase64: string; mimeType: string }>;
  synthesizeDialogue(lines: { speaker: string; text: string; voiceName?: string; style?: string }[]): Promise<{ audioBase64: string; mimeType: string }>;
  transcribeAudio(audioBase64: string, mimeType: string): Promise<string>;
  coachPronunciation(targetText: string, transcript: string, environment: string, cefrLevel: string): Promise<PronunciationFeedbackResult>;
  evaluateActivityAnswer(prompt: string, learnerResponse: string, environment: string, cefrLevel: string): Promise<{ feedback: string; suggestions: string[] }>;
  summarizeConversation(transcript: { role: string; text: string }[], mode: string, environment: string, cefrLevel: string): Promise<{ summary: string; vocabularyNotes: { term: string; explanation: string }[] }>;
}

let _aiClient: GoogleGenAI | null = null;

const MAX_TTS_CACHE_ENTRIES = 50;
const MAX_TTS_CACHE_TEXT_CHARS = 300;
const TTS_CACHE_TTL_MS = 15 * 60 * 1000;
const ttsCache = new Map<string, { audioBase64: string; mimeType: string; expiresAt: number }>();

function getCachedTts(key: string): { audioBase64: string; mimeType: string } | null {
  const entry = ttsCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    ttsCache.delete(key);
    return null;
  }
  // Refresh LRU order
  ttsCache.delete(key);
  ttsCache.set(key, entry);
  return { audioBase64: entry.audioBase64, mimeType: entry.mimeType };
}

function setCachedTts(key: string, value: { audioBase64: string; mimeType: string }) {
  if (ttsCache.size >= MAX_TTS_CACHE_ENTRIES) {
    const oldestKey = ttsCache.keys().next().value;
    if (oldestKey) ttsCache.delete(oldestKey);
  }
  ttsCache.set(key, { ...value, expiresAt: Date.now() + TTS_CACHE_TTL_MS });
}

export function sanitizeAiErrorMessage(err: unknown, fallbackMessage: string): string {
  const anyErr = err as { status?: number; code?: number | string; message?: string } | undefined;
  const status = anyErr?.status ?? anyErr?.code;
  const msg = typeof anyErr?.message === 'string' ? anyErr.message : '';

  if (status === 429 || status === 'RESOURCE_EXHAUSTED' || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    return 'Free-tier AI quota or rate limit reached. Please pause briefly or continue in local practice mode.';
  }
  if (status === 404 || status === 'NOT_FOUND' || /NOT_FOUND/i.test(msg)) {
    return 'The configured AI model is unavailable or unsupported for this account.';
  }
  if (status === 401 || status === 403 || status === 'PERMISSION_DENIED') {
    return 'AI provider credentials do not have access to this configured model.';
  }
  return fallbackMessage;
}

export function getGeminiClient(): GoogleGenAI | null {
  if (!isGeminiApiKeySet()) return null;
  if (!_aiClient) {
    _aiClient = new GoogleGenAI({
      apiKey: env.geminiApiKey,
      httpOptions: {
        apiVersion: 'v1beta',
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return _aiClient;
}

export function compareTranscriptWords(targetText: string, transcript: string): {
  comparison: WordComparisonItem[];
  matchedRatio: number;
} {
  const clean = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\w\s']/g, '')
      .split(/\s+/)
      .filter(Boolean);

  const targetWords = clean(targetText);
  const spokenWords = clean(transcript);

  if (targetWords.length === 0) {
    return { comparison: [], matchedRatio: 0 };
  }

  let matchedCount = 0;
  const spokenPool = [...spokenWords];

  const comparison: WordComparisonItem[] = targetWords.map((word, index) => {
    if (spokenWords[index] === word) {
      matchedCount += 1;
      return { word, status: 'matched' };
    }
    const foundIdx = spokenPool.indexOf(word);
    if (foundIdx !== -1) {
      spokenPool.splice(foundIdx, 1);
      matchedCount += 1;
      return { word, status: 'matched' };
    }
    if (spokenWords[index]) {
      return { word, status: 'substituted' };
    }
    return { word, status: 'missing' };
  });

  return {
    comparison,
    matchedRatio: Math.round((matchedCount / targetWords.length) * 100) / 100,
  };
}

const SAUTI_SWAHILI_STYLE_NOTE =
  'Pronounce "Sauti" in authentic Swahili (Kiswahili) as three distinct syllables with stress on the middle syllable: "sah-OO-tee" (/sɑˈu.ti/), never "saw-tee", "sow-tee", or spelled letter-by-letter.';

export function prepareTtsPronunciation(text: string, style?: string): { text: string; style: string } {
  const baseStyle = style || 'Warm, clear, natural English educator';
  if (!/\bsauti\b/i.test(text)) {
    return { text, style: baseStyle };
  }
  const normalizedText = text.replace(/\bSAUTI\b/g, 'Sauti');
  const nextStyle = baseStyle.includes('/sɑˈu.ti/')
    ? baseStyle
    : `${baseStyle}. ${SAUTI_SWAHILI_STYLE_NOTE}`;
  return { text: normalizedText, style: nextStyle };
}

class GeminiVoiceProvider implements IVoiceProvider {
  isConfigured(): boolean {
    return isGeminiConfigured();
  }

  isCapabilityConfigured(capability: AiCapability): boolean {
    return isCapabilityConfigured(capability);
  }

  async synthesizeSpeech(text: string, voiceName = 'Kore', style = 'Warm, clear, natural English educator') {
    const ttsModel = requireConfiguredModel('tts');
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured for server-side TTS.');
    }

    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const selectedVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';
    const prepared = prepareTtsPronunciation(text, style);
    const cacheKey = `${ttsModel}::${selectedVoice}::${prepared.text}::${prepared.style}`;
    if (prepared.text.length <= MAX_TTS_CACHE_TEXT_CHARS) {
      const cached = getCachedTts(cacheKey);
      if (cached) return cached;
    }

    const response = await ai.models.generateContent({
      model: ttsModel,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prepared.text,
              speechMetadata: {
                style: prepared.style,
              },
            } as any,
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Speech synthesis did not return audio data.');
    }

    const result = {
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    };
    if (prepared.text.length <= MAX_TTS_CACHE_TEXT_CHARS) {
      setCachedTts(cacheKey, result);
    }
    return result;
  }

  async synthesizeDialogue(lines: { speaker: string; text: string; voiceName?: string; style?: string }[]) {
    const speakers = Array.from(new Set(lines.map((l) => l.speaker))).slice(0, 2);
    if (speakers.length < 2) {
      return this.synthesizeSpeech(lines.map((l) => l.text).join(' '), lines[0]?.voiceName || 'Kore');
    }

    const multiTtsModel = requireConfiguredModel('multiTts');
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured for multi-speaker TTS.');
    }

    const parts = lines.map((line) => {
      const prepared = prepareTtsPronunciation(line.text, line.style || 'Natural conversational English');
      return {
        text: `${line.speaker}: ${prepared.text}`,
        speechMetadata: {
          speaker: line.speaker,
          style: prepared.style,
        },
      };
    });

    const response = await ai.models.generateContent({
      model: multiTtsModel,
      contents: [{ role: 'user', parts: parts as any }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: speakers[0],
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
              },
              {
                speaker: speakers[1],
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
              },
            ],
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Multi-speaker synthesis did not return audio data.');
    }
    return { audioBase64: base64Audio, mimeType: 'audio/wav' };
  }

  async transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
    const transcribeModel = requireConfiguredModel('transcribe');
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured for speech transcription.');
    }

    const response = await ai.models.generateContent({
      model: transcribeModel,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'audio/webm',
              data: audioBase64,
            },
          },
          { text: 'Transcribe this spoken English audio accurately. Return only the spoken words.' },
        ],
      },
    });

    return (response.text || '').trim();
  }

  async coachPronunciation(
    targetText: string,
    transcript: string,
    environment: string,
    cefrLevel: string
  ): Promise<PronunciationFeedbackResult> {
    const { comparison, matchedRatio } = compareTranscriptWords(targetText, transcript);
    const phoneticDisclaimer =
      'Word comparison is based on speech-to-text transcription rather than acoustic phoneme measurement. Use the reference audio to compare rhythm and vowel clarity.';

    const ai = getGeminiClient();
    const textModel = getConfiguredModel('text');
    if (!ai || !textModel) {
      const missingOrSub = comparison.filter((c) => c.status !== 'matched').map((c) => c.word);
      const guidance =
        missingOrSub.length === 0
          ? 'Your spoken transcript matched all target words clearly. Replay your recording alongside the reference audio to compare stress and pacing.'
          : `Focus on speaking these words slowly and clearly: ${missingOrSub.join(', ')}. Listen to the reference audio once more and try again.`;

      return {
        targetText,
        transcript,
        comparison,
        matchedRatio,
        guidance,
        phoneticDisclaimer,
        aiPowered: false,
      };
    }

    const missed = comparison.filter((c) => c.status !== 'matched').map((c) => c.word);
    const safetyGuard = buildAgeSafetyPromptGuard(environment);
    try {
      const response = await ai.models.generateContent({
        model: textModel,
        contents: `Target phrase: "${targetText}"
Transcribed speech: "${transcript}"
Words differing in transcript: ${missed.length ? missed.join(', ') : 'None'}
Learner environment: ${environment}, CEFR level: ${cefrLevel}.
Provide 2-3 encouraging, practical sentences of English pronunciation and phrasing guidance tailored to this learner. Never invent phonetic accuracy percentages.`,
        config: {
          systemInstruction: `You are SAUTI Pronunciation Coach. Be encouraging, warm, clear, and honest about what speech transcription can and cannot observe. ${safetyGuard}`,
        },
      });

      return {
        targetText,
        transcript,
        comparison,
        matchedRatio,
        guidance: (response.text || '').trim() || 'Great effort! Listen closely to the rhythm and try one more time.',
        phoneticDisclaimer,
        aiPowered: true,
      };
    } catch {
      const missingOrSub = comparison.filter((c) => c.status !== 'matched').map((c) => c.word);
      return {
        targetText,
        transcript,
        comparison,
        matchedRatio,
        guidance:
          missingOrSub.length === 0
            ? 'Your spoken transcript matched the target words clearly. Replay your recording to check rhythm and stress.'
            : `Focus on speaking these words slowly and clearly: ${missingOrSub.join(', ')}.`,
        phoneticDisclaimer,
        aiPowered: false,
      };
    }
  }

  async evaluateActivityAnswer(
    prompt: string,
    learnerResponse: string,
    environment: string,
    cefrLevel: string
  ): Promise<{ feedback: string; suggestions: string[] }> {
    const ai = getGeminiClient();
    const textModel = getConfiguredModel('text');
    if (!ai || !textModel) {
      return {
        feedback: 'Thank you for sharing your response! Keep practising complete sentences at your own pace.',
        suggestions: ['Read your response aloud in Voice Studio to build speaking fluency.'],
      };
    }

    const safetyGuard = buildAgeSafetyPromptGuard(environment);
    try {
      const response = await ai.models.generateContent({
        model: textModel,
        contents: `Activity prompt: "${prompt}"
Learner response: "${learnerResponse}"
Environment: ${environment}, CEFR level: ${cefrLevel}.`,
        config: {
          systemInstruction: `You are an encouraging SAUTI English teacher. Give brief, kind, constructive feedback appropriate to the learner age and CEFR level. ${safetyGuard}`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              feedback: { type: Type.STRING },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['feedback', 'suggestions'],
          },
        },
      });

      return JSON.parse(response.text || '{}');
    } catch {
      return {
        feedback: 'Well done completing this exercise!',
        suggestions: ['Try saying your answer aloud to reinforce confidence.'],
      };
    }
  }

  async summarizeConversation(
    transcript: { role: string; text: string }[],
    mode: string,
    environment: string,
    cefrLevel: string
  ): Promise<{ summary: string; vocabularyNotes: { term: string; explanation: string }[] }> {
    const ai = getGeminiClient();
    const textModel = getConfiguredModel('text');
    if (!ai || !textModel || transcript.length === 0) {
      return {
        summary: `Completed a ${mode} speaking session (${cefrLevel}). Keep practising short daily conversations.`,
        vocabularyNotes: [
          { term: 'Confidence', explanation: 'Speaking clearly at a comfortable pace without rushing.' },
        ],
      };
    }

    const safetyGuard = buildAgeSafetyPromptGuard(environment);
    const formatted = transcript
      .slice(-60)
      .map((t) => `${t.role === 'user' ? 'Learner' : 'SAUTI'}: ${t.text.slice(0, 500)}`)
      .join('\n');

    try {
      const response = await ai.models.generateContent({
        model: textModel,
        contents: `Mode: ${mode}, Environment: ${environment}, CEFR: ${cefrLevel}\n\nTranscript:\n${formatted}`,
        config: {
          systemInstruction: `Summarize this English learning conversation warmly, highlighting strengths, 1 gentle suggestion, and up to 3 useful vocabulary notes. Do not include personal identifying information in the summary. ${safetyGuard}`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              vocabularyNotes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    term: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ['term', 'explanation'],
                },
              },
            },
            required: ['summary', 'vocabularyNotes'],
          },
        },
      });

      return JSON.parse(response.text || '{}');
    } catch {
      return {
        summary: 'Great conversation practice session!',
        vocabularyNotes: [],
      };
    }
  }
}

export const voiceProvider: IVoiceProvider = new GeminiVoiceProvider();
