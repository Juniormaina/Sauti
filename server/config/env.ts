import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET || 'sauti-dev-session-secret-change-in-prod',
  geminiApiKey: process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    ? process.env.GEMINI_API_KEY
    : '',
  models: {
    text: process.env.GEMINI_TEXT_MODEL || 'gemini-4-hydrogen',
    tts: process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-lite-tts',
    multiTts: process.env.GEMINI_MULTI_TTS_MODEL || 'gemini-3.8-flash-tts',
    transcribe: process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe',
    live: process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live',
  },
};

export function isGeminiConfigured(): boolean {
  return Boolean(env.geminiApiKey && env.geminiApiKey.trim().length > 10);
}
