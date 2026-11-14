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

const EXACT_HOSTNAME_REGEX =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const AI_STUDIO_PREVIEW_HOST_REGEX =
  /^ais-(?:dev|pre)-[a-z0-9-]+(?:\.[a-z0-9-]+)*\.run\.app$/;

export function isValidExactHostname(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 253) return false;
  if (
    trimmed.startsWith('.') ||
    trimmed.includes('*') ||
    trimmed.includes(':') ||
    trimmed.includes('/') ||
    trimmed.includes('@') ||
    trimmed.includes('?') ||
    trimmed.includes('#') ||
    /\s/.test(trimmed) ||
    trimmed === 'my_app_url'
  ) {
    return false;
  }
  return EXACT_HOSTNAME_REGEX.test(trimmed);
}

export function isTrustedAiStudioPreviewHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return isValidExactHostname(normalized) && AI_STUDIO_PREVIEW_HOST_REGEX.test(normalized);
}

export function parseViteAllowedHosts(options?: {
  appUrl?: string;
  allowedOrigins?: string;
  ngAllowedHosts?: string;
}): string[] {
  const hosts = new Set<string>(['localhost', '127.0.0.1']);

  const addHostnameFromOriginCandidate = (raw?: string) => {
    const trimmed = raw?.trim();
    if (!trimmed || trimmed === 'MY_APP_URL' || trimmed === '*') return;
    const normalizedOrigin = normalizeOrigin(trimmed);
    if (!normalizedOrigin) return;
    try {
      const hostname = new URL(normalizedOrigin).hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        isTrustedAiStudioPreviewHostname(hostname)
      ) {
        hosts.add(hostname);
      }
    } catch {
      // Ignore malformed origin candidates
    }
  };

  const appUrlRaw = options?.appUrl !== undefined ? options.appUrl : process.env.APP_URL;
  addHostnameFromOriginCandidate(appUrlRaw);

  const allowedOriginsRaw =
    options?.allowedOrigins !== undefined ? options.allowedOrigins : process.env.ALLOWED_ORIGINS;
  if (allowedOriginsRaw) {
    for (const part of allowedOriginsRaw.split(',')) {
      addHostnameFromOriginCandidate(part);
    }
  }

  const ngAllowedHostsRaw =
    options?.ngAllowedHosts !== undefined ? options.ngAllowedHosts : process.env.NG_ALLOWED_HOSTS;
  if (ngAllowedHostsRaw) {
    for (const part of ngAllowedHostsRaw.split(',')) {
      const trimmed = part.trim().toLowerCase();
      if (
        trimmed === 'localhost' ||
        trimmed === '127.0.0.1' ||
        isTrustedAiStudioPreviewHostname(trimmed)
      ) {
        hosts.add(trimmed);
      }
    }
  }

  return Array.from(hosts);
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

export type AiCapability = 'text' | 'tts' | 'multiTts' | 'transcribe' | 'live';

export const AI_MODEL_ENV_KEYS: Record<AiCapability, string> = {
  text: 'GEMINI_TEXT_MODEL',
  tts: 'GEMINI_TTS_MODEL',
  multiTts: 'GEMINI_MULTI_TTS_MODEL',
  transcribe: 'GEMINI_TRANSCRIBE_MODEL',
  live: 'GEMINI_LIVE_MODEL',
};

function readModelEnv(envKey: string): string | null {
  const raw = process.env[envKey];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidModelIdentifier(model: string): boolean {
  return model.length > 0 && model.length <= 128 && !/\s/.test(model);
}

const nonBrowserWsEnabled = process.env.WS_ALLOW_NON_BROWSER_CLIENTS === 'true';
const nonBrowserWsKey = process.env.WS_NON_BROWSER_KEY?.trim() || '';

export const env = {
  port,
  nodeEnv,
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  allowedOrigins: parseAllowedOrigins(),
  viteAllowedHosts: parseViteAllowedHosts(),
  trustProxy: resolveRuntimeTrustProxy(),
  nonBrowserWs: {
    enabled: nonBrowserWsEnabled && nonBrowserWsKey.length >= 16,
    clientKey: nonBrowserWsKey,
  },
  sessionSecret,
  geminiApiKey:
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
      ? process.env.GEMINI_API_KEY.trim()
      : '',
  strictAiModelValidation: process.env.AI_STRICT_MODEL_VALIDATION === 'true',
  models: {
    text: readModelEnv(AI_MODEL_ENV_KEYS.text),
    tts: readModelEnv(AI_MODEL_ENV_KEYS.tts),
    multiTts: readModelEnv(AI_MODEL_ENV_KEYS.multiTts),
    transcribe: readModelEnv(AI_MODEL_ENV_KEYS.transcribe),
    live: readModelEnv(AI_MODEL_ENV_KEYS.live),
  } as Record<AiCapability, string | null>,
};

export function isGeminiApiKeySet(apiKeyOverride?: string): boolean {
  const key = apiKeyOverride !== undefined ? apiKeyOverride : env.geminiApiKey;
  return Boolean(key && key.trim().length > 10 && key.trim() !== 'MY_GEMINI_API_KEY');
}

export function getConfiguredModel(
  capability: AiCapability,
  modelsOverride?: Partial<Record<AiCapability, string | null>>
): string | null {
  const raw = modelsOverride ? modelsOverride[capability] : env.models[capability];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!isValidModelIdentifier(trimmed)) return null;
  return trimmed;
}

export function isCapabilityConfigured(
  capability: AiCapability,
  options?: { geminiApiKey?: string; models?: Partial<Record<AiCapability, string | null>> }
): boolean {
  return (
    isGeminiApiKeySet(options?.geminiApiKey) &&
    Boolean(getConfiguredModel(capability, options?.models))
  );
}

export function requireConfiguredModel(
  capability: AiCapability,
  options?: { geminiApiKey?: string; models?: Partial<Record<AiCapability, string | null>> }
): string {
  if (!isGeminiApiKeySet(options?.geminiApiKey)) {
    throw new Error(
      `GEMINI_API_KEY is not configured; cannot execute "${capability}" AI request without API credentials.`
    );
  }
  const model = getConfiguredModel(capability, options?.models);
  if (!model) {
    throw new Error(
      `Missing ${AI_MODEL_ENV_KEYS[capability]} environment variable for "${capability}" capability. Refusing to fall back to a hardcoded model.`
    );
  }
  return model;
}

export function getAiCapabilitiesStatus(options?: {
  geminiApiKey?: string;
  models?: Partial<Record<AiCapability, string | null>>;
}): Record<AiCapability, boolean> {
  return {
    text: isCapabilityConfigured('text', options),
    tts: isCapabilityConfigured('tts', options),
    multiTts: isCapabilityConfigured('multiTts', options),
    transcribe: isCapabilityConfigured('transcribe', options),
    live: isCapabilityConfigured('live', options),
  };
}

export function isGeminiConfigured(): boolean {
  return Object.values(getAiCapabilitiesStatus()).some(Boolean);
}

export interface AiConfigurationValidationResult {
  ok: boolean;
  strict: boolean;
  mode: 'disabled' | 'unconfigured_models' | 'partial' | 'configured';
  apiKeyConfigured: boolean;
  configuredCapabilities: AiCapability[];
  missingCapabilities: AiCapability[];
  missingEnvVars: string[];
  invalidModelEnvVars: string[];
  errors: string[];
  warnings: string[];
}

export function validateAiConfiguration(options?: {
  geminiApiKey?: string;
  models?: Partial<Record<AiCapability, string | null>>;
  strict?: boolean;
  requiredCapabilities?: AiCapability[];
}): AiConfigurationValidationResult {
  const strict = options?.strict ?? env.strictAiModelValidation;
  const apiKeyConfigured = isGeminiApiKeySet(options?.geminiApiKey);
  const modelsSource = options?.models ?? env.models;
  const capabilitiesToCheck: AiCapability[] =
    options?.requiredCapabilities ?? ['text', 'tts', 'multiTts', 'transcribe', 'live'];

  const configuredCapabilities: AiCapability[] = [];
  const missingCapabilities: AiCapability[] = [];
  const missingEnvVars: string[] = [];
  const invalidModelEnvVars: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const capability of capabilitiesToCheck) {
    const envKey = AI_MODEL_ENV_KEYS[capability];
    const rawValue = modelsSource[capability];
    if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
      if (!isValidModelIdentifier(rawValue.trim())) {
        invalidModelEnvVars.push(envKey);
        errors.push(`${envKey} contains an invalid model identifier (whitespace or invalid length).`);
      } else {
        configuredCapabilities.push(capability);
      }
    } else {
      missingCapabilities.push(capability);
      missingEnvVars.push(envKey);
    }
  }

  let mode: AiConfigurationValidationResult['mode'];
  if (!apiKeyConfigured) {
    mode = 'disabled';
    warnings.push(
      'GEMINI_API_KEY is not set; running in zero-budget fallback mode (browser SpeechSynthesis, deterministic word comparison, and Demo Mode).'
    );
  } else if (configuredCapabilities.length === 0) {
    mode = 'unconfigured_models';
    warnings.push(
      `GEMINI_API_KEY is set, but no model environment variables are configured (${missingEnvVars.join(', ')}). AI features remain in zero-budget fallback/unavailable mode.`
    );
  } else if (missingCapabilities.length > 0) {
    mode = 'partial';
    warnings.push(
      `Independent AI capabilities enabled: [${configuredCapabilities.join(', ')}]. Unconfigured capabilities (${missingEnvVars.join(', ')}) will use zero-budget fallback or return 503.`
    );
  } else {
    mode = 'configured';
  }

  if (strict) {
    if (!apiKeyConfigured) {
      errors.push('GEMINI_API_KEY is required when AI_STRICT_MODEL_VALIDATION=true.');
    }
    if (missingEnvVars.length > 0) {
      errors.push(
        `Missing required AI model environment variables: ${missingEnvVars.join(', ')}.`
      );
    }
  }

  return {
    ok: errors.length === 0,
    strict,
    mode,
    apiKeyConfigured,
    configuredCapabilities,
    missingCapabilities,
    missingEnvVars,
    invalidModelEnvVars,
    errors,
    warnings,
  };
}

export function assertAiConfigurationOnStartup(options?: {
  geminiApiKey?: string;
  models?: Partial<Record<AiCapability, string | null>>;
  strict?: boolean;
  requiredCapabilities?: AiCapability[];
}): AiConfigurationValidationResult {
  const result = validateAiConfiguration(options);
  for (const warning of result.warnings) {
    console.info(`[SAUTI AI Config] ${warning}`);
  }
  if (!result.ok) {
    const detail = result.errors.join(' ');
    console.error(`[SAUTI AI Config Error] ${detail}`);
    throw new Error(`AI configuration validation failed: ${detail}`);
  }
  if (result.mode === 'configured') {
    console.info(
      `[SAUTI AI Config] All independent AI model capabilities configured (${result.configuredCapabilities.join(', ')}).`
    );
  }
  return result;
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

