import { GoogleGenAI, Type } from '@google/genai';
import { env, isGeminiConfigured } from '../config/env.ts';
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
  synthesizeSpeech(text: string, voiceName?: string, style?: string): Promise<{ audioBase64: string; mimeType: string }>;
  synthesizeDialogue(lines: { speaker: string; text: string; voiceName?: string; style?: string }[]): Promise<{ audioBase64: string; mimeType: string }>;
  transcribeAudio(audioBase64: string, mimeType: string): Promise<string>;
  coachPronunciation(targetText: string, transcript: string, environment: string, cefrLevel: string): Promise<PronunciationFeedbackResult>;
  evaluateActivityAnswer(prompt: string, learnerResponse: string, environment: string, cefrLevel: string): Promise<{ feedback: string; suggestions: string[] }>;
  summarizeConversation(transcript: { role: string; text: string }[], mode: string, environment: string, cefrLevel: string): Promise<{ summary: string; vocabularyNotes: { term: string; explanation: string }[] }>;
}

let _aiClient: GoogleGenAI | null = null;

export function sanitizeAiErrorMessage(err: unknown, fallbackMessage: string): string {
  const status = (err as any)?.status || (err as any)?.code;
  if (status === 429) {
    return 'Voice service is temporarily busy. Please try again in a moment.';
  }
  return fallbackMessage;
}

export function getGeminiClient(): GoogleGenAI | null {
  if (!isGeminiConfigured()) return null;
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

class GeminiVoiceProvider implements IVoiceProvider {
  isConfigured(): boolean {
    return isGeminiConfigured();
  }

  async synthesizeSpeech(text: string, voiceName = 'Kore', style = 'Warm, clear, natural English educator') {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured for server-side TTS.');
    }

    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const selectedVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';

    const response = await ai.models.generateContent({
      model: env.models.tts,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text,
              speechMetadata: {
                style,
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

    return {
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    };
  }

  async synthesizeDialogue(lines: { speaker: string; text: string; voiceName?: string; style?: string }[]) {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured for multi-speaker TTS.');
    }
    const speakers = Array.from(new Set(lines.map((l) => l.speaker))).slice(0, 2);
    if (speakers.length < 2) {
      return this.synthesizeSpeech(lines.map((l) => l.text).join(' '), lines[0]?.voiceName || 'Kore');
    }

    const parts = lines.map((line) => ({
      text: `${line.speaker}: ${line.text}`,
      speechMetadata: {
        speaker: line.speaker,
        style: line.style || 'Natural conversational English',
      },
    }));

    const response = await ai.models.generateContent({
      model: env.models.multiTts,
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
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error('Gemini API key is not configured for speech transcription.');
    }

    const response = await ai.models.generateContent({
      model: env.models.transcribe,
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
    if (!ai) {
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
        model: env.models.text,
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
    if (!ai) {
      return {
        feedback: 'Thank you for sharing your response! Keep practising complete sentences at your own pace.',
        suggestions: ['Read your response aloud in Voice Studio to build speaking fluency.'],
      };
    }

    const safetyGuard = buildAgeSafetyPromptGuard(environment);
    try {
      const response = await ai.models.generateContent({
        model: env.models.text,
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
    if (!ai || transcript.length === 0) {
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
        model: env.models.text,
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
