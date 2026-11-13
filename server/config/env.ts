import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { ParsedTrustProxyConfig, parseTrustProxyConfig } from './trustProxy.ts';

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
const nodeEnv = process.env.NODE_ENV || 'development';
const port = Number(process.env.PORT || 3000);

export function normalizeOrigin(raw?: string | string[] | null): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    if (raw.length !== 1) return null;
    raw = raw[0];
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*' || trimmed.toLowerCase() === 'null') {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  if (!parsed.origin || parsed.origin === 'null') {
    return null;
  }
  // Origin header must represent scheme://host[:port] without path/query/hash/credentials
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    // Allow APP_URL values that may include a trailing slash or path when parsing allowlist,
    // while strictly validating raw Origin headers in callers if needed.
    return parsed.origin;
  }
  return parsed.origin;
}

export function normalizeOriginHeader(raw?: string | string[] | null): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    if (raw.length !== 1) return null;
    raw = raw[0];
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*' || trimmed.toLowerCase() === 'null') {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    return null;
  }
  return parsed.origin;
}

function parseAllowedOrigins(): string[] {
  const origins = new Set<string>();

  if (nodeEnv !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
    if (Number.isInteger(port) && port > 0 && port <= 65535) {
      origins.add(`http://localhost:${port}`);
      origins.add(`http://127.0.0.1:${port}`);
    }
  }

  const candidates = [
    process.env.APP_URL,
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
  ];

  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed || trimmed === 'MY_APP_URL' || trimmed === '*') continue;
    const normalized = normalizeOrigin(trimmed);
    if (normalized) {
      origins.add(normalized);
    }
  }

  return Array.from(origins);
}

function resolveRuntimeTrustProxy(): ParsedTrustProxyConfig {
  const raw = process.env.TRUST_PROXY;
  if (raw !== undefined && raw.trim().length > 0) {
    const parsed = parseTrustProxyConfig(raw);
    if (!parsed.isValid) {
      console.warn(
        `Invalid TRUST_PROXY configuration (${parsed.reason || 'invalid'}); failing safely with proxy trust disabled.`
      );
    }
    return parsed;
  }

  // On Cloud Run production deployments without explicit TRUST_PROXY, trust only
  // loopback/linklocal/uniquelocal reverse-proxy hops (never arbitrary public IPs).
  if (nodeEnv === 'production' && Boolean(process.env.K_SERVICE)) {
    return parseTrustProxyConfig(['loopback', 'linklocal', 'uniquelocal']);
  }

  return parseTrustProxyConfig(false);
}

const nonBrowserWsEnabled = process.env.WS_ALLOW_NON_BROWSER_CLIENTS === 'true';
const nonBrowserWsKey = process.env.WS_NON_BROWSER_KEY?.trim() || '';

export const env = {
  port,
  nodeEnv,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  allowedOrigins: parseAllowedOrigins(),
  trustProxy: resolveRuntimeTrustProxy(),
  nonBrowserWs: {
    enabled: nonBrowserWsEnabled && nonBrowserWsKey.length >= 16,
    clientKey: nonBrowserWsKey,
  },
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
  options?: { allowMissingOrigin?: boolean; allowedOrigins?: readonly string[] }
): boolean {
  if (!originHeader || (Array.isArray(originHeader) && originHeader.length === 0)) {
    return Boolean(options?.allowMissingOrigin);
  }
  if (typeof originHeader === 'string' && originHeader.trim().length === 0) {
    return Boolean(options?.allowMissingOrigin);
  }

  const normalizedOrigin = normalizeOriginHeader(originHeader);
  if (!normalizedOrigin) {
    return false;
  }

  const rawList = options?.allowedOrigins ?? env.allowedOrigins;
  for (const candidate of rawList) {
    const normalizedCandidate = normalizeOrigin(candidate);
    if (normalizedCandidate && normalizedCandidate === normalizedOrigin) {
      return true;
    }
  }

  return false;
}

export function isAuthenticatedNonBrowserClient(
  headers: Record<string, string | string[] | undefined>,
  overrideConfig?: { enabled: boolean; clientKey: string }
): boolean {
  const cfg = overrideConfig ?? env.nonBrowserWs;
  if (!cfg.enabled || cfg.clientKey.length < 16) {
    return false;
  }
  // Browser requests carry an Origin header; non-browser auth must never bypass browser Origin checks.
  if (headers.origin) {
    return false;
  }

  const provided = headers['x-sauti-client-key'];
  const rawKey = Array.isArray(provided) ? provided[0] : provided;
  if (!rawKey || typeof rawKey !== 'string') {
    return false;
  }

  const providedBuf = Buffer.from(rawKey.trim(), 'utf8');
  const expectedBuf = Buffer.from(cfg.clientKey, 'utf8');
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

