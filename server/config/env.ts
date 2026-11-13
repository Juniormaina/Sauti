import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

function resolveSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (
    configured &&
    configured.length >= 16 &&
    configured !== 'change-this-session-secret-in-production' &&
    configured !== 'sauti-dev-session-secret-change-in-prod'
  ) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET environment variable must be set to a strong secret (16+ characters) in production.'
    );
  }

  // Generate an ephemeral CSPRNG secret per dev/test process rather than using a known static literal.
  return crypto.randomBytes(32).toString('hex');
}

const sessionSecret = resolveSessionSecret();

function parseAllowedOrigins(): string[] {
  const origins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);

  const candidates = [
    process.env.APP_URL,
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
  ];

  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed || trimmed === 'MY_APP_URL') continue;
    try {
      const parsed = new URL(trimmed);
      origins.add(parsed.origin);
    } catch {
      // Ignore malformed origin config values
    }
  }

  return Array.from(origins);
}

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  allowedOrigins: parseAllowedOrigins(),
  sessionSecret,
  geminiApiKey:
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
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

export function isPermittedOrigin(
  originHeader?: string | string[] | null,
  hostHeader?: string | string[] | null,
  options?: { allowMissingOrigin?: boolean }
): boolean {
  const originRaw = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (!originRaw) {
    return Boolean(options?.allowMissingOrigin);
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originRaw);
  } catch {
    return false;
  }

  if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
    return false;
  }

  if (env.allowedOrigins.includes(parsedOrigin.origin)) {
    return true;
  }

  const hostRaw = (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader)?.trim();
  if (hostRaw && parsedOrigin.host.toLowerCase() === hostRaw.toLowerCase()) {
    return true;
  }

  return false;
}
