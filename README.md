# SAUTI — Voice-First English Learning Platform

> **"Don't just learn English. Find your voice."**
> *"Speak with confidence. Learn at your own pace."*

SAUTI is a full-stack, voice-first English learning platform serving learners across six age environments—`Little Voices` (3–5), `Young Explorers` (6–10), `Teen Voices` (11–17), `Young Adults` (18–25), `Professional English` (26–45), and `Lifelong English` (46+)—with independent CEFR proficiency tiers (`A1`–`C2`), age-tailored layouts, a 4-mode Voice Studio powered by Gemini APIs (TTS, transcription, pronunciation coaching, and Live API), and dedicated Parent, Teacher, and Admin portals.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Motion for React, Lucide React, Zustand, React Hook Form + Zod, Firebase Auth (`signInWithPopup` Google Sign-In)
- **Backend:** Node.js, Express, TypeScript (`tsx`), WebSockets (`ws`)
- **Database:** Cloud SQL for PostgreSQL + Drizzle ORM (`src/db/schema.ts`)
- **AI & Voice:** `@google/genai` (`v1beta` HTTP options for TTS/dialogue; configurable `gemini-4-hydrogen`, `gemini-3.8-flash-lite-tts`, `gemini-3.8-flash-tts`, `gemini-3.5-transcribe`, `gemini-3.8-live`)

---

## Project Structure

```text
├── server.ts                         # HTTP + Vite/static entry point + WS attachment
├── server/
│   ├── app.ts                        # Hardened Express app, headers, origin checks, JSON limits
│   ├── config/env.ts                 # Env config, CSPRNG/strict SESSION_SECRET, origin allowlist
│   ├── middleware/
│   │   ├── auth.ts                   # Firebase ID token & HMAC session verification, RBAC
│   │   └── rateLimit.ts              # Sliding-window per-user / per-IP rate limiter
│   ├── routes/                       # auth, learning, voice, parent, teacher, admin REST APIs
│   ├── services/
│   │   ├── aiVoiceService.ts         # Gemini TTS, dialogue, transcription, coaching, age guards
│   │   ├── authService.ts            # scrypt password hashing, HMAC tokens, Firebase user sync
│   │   ├── authorizationService.ts   # Learner ownership & teacher classroom authorisation helpers
│   │   ├── childSafetyService.ts     # Age-tier boundaries, Live safety, consent & transcript rules
│   │   ├── liveTicketService.ts      # Single-use WS ticket issuance & active session revocation
│   │   ├── progressService.ts        # Atomic XP increments & idempotent achievement awards
│   │   └── seedService.ts            # Curriculum, lesson, activity, and achievement seeding
│   └── ws/liveVoiceServer.ts         # Pre-upgrade authenticated /ws/live Gemini Live bridge
├── src/
│   ├── app/layouts/                  # KidsLayout, TeenLayout, AdultLayout, PortalLayout
│   ├── components/                   # PublicHeader, ResilientImage, ActivityRunner (15 types)
│   ├── db/                           # Drizzle schema, pg.Pool connection, drizzle.config.ts
│   ├── hooks/                        # useAudioRecorder (MediaRecorder), useSpeechPlayback
│   ├── lib/                          # firebase.ts (client), firebase-admin.ts (server)
│   ├── pages/                        # marketing, auth, onboarding, learner, voice, parent, teacher, admin
│   ├── services/                     # Typed API client
│   ├── stores/                       # Zustand authStore
│   ├── types/                        # Shared TypeScript interfaces
│   └── utils/                        # Age environment tokens & asset constants
├── tests/                            # Automated unit, IDOR, WS, child-safety & anti-farming suite
└── .env.example
```

---

## Environment Variables

Configure via environment variables (see `.env.example`):

- `GEMINI_API_KEY`: Server-side Gemini API key (never exposed to browser code)
- `GEMINI_TEXT_MODEL` (default `gemini-4-hydrogen`)
- `GEMINI_TTS_MODEL` (default `gemini-3.8-flash-lite-tts`)
- `GEMINI_MULTI_TTS_MODEL` (default `gemini-3.8-flash-tts`)
- `GEMINI_TRANSCRIBE_MODEL` (default `gemini-3.5-transcribe`)
- `GEMINI_LIVE_MODEL` (default `gemini-3.8-live`)
- `APP_URL`: Hosted application URL used for permitted origin checks
- `ALLOWED_ORIGINS`: Optional comma-separated list of additional permitted browser origins
- `SESSION_SECRET`: HMAC signing key for email/password sessions & Live tickets (required 16+ char secret when `NODE_ENV=production`; ephemeral CSPRNG per process in dev/test when unset)
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`: Runtime Cloud SQL PostgreSQL pool credentials
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`: Drizzle Kit schema management credentials

---

## Current Security, Safety & Reliability State

- **Learner, Parent & Classroom Ownership (`authorizationService.ts`):** All learner dashboards, activity attempts, lesson completions, history, settings, and voice sessions enforce ownership (`learner.userId === authUser.id` or linked `parent.userId === authUser.id`), returning uniform `404` responses on missing or unrelated IDs. Teacher classroom reads and learner enrollments verify `classroom.teacherId`.
- **Authenticated Live Voice WebSocket (`liveTicketService.ts`, `liveVoiceServer.ts`):** Clients obtain a 45-second single-use ticket from `POST /api/voice/live-ticket`. `/ws/live` verifies `Origin`, rejects legacy `?token=` URLs, atomically consumes the ticket, re-verifies learner/parent safety from PostgreSQL, enforces per-user/IP connection caps before upgrading, validates incoming frame sizes, and applies 15-minute max duration and 3-minute idle timeouts.
- **Child Safety & Age-Tier Isolation (`childSafetyService.ts`):**
  - Under-13 learners (`little_voices`, `young_explorers`) cannot self-register as `individual` accounts and require a linked parent account with active consent.
  - All three minor tiers (`little_voices`, `young_explorers`, `teen_voices` when parent-linked) obey `allowAiLiveForChildren`, mode restrictions, course environment boundaries, and prompt safety guardrails; minor accounts cannot self-promote into adult environments.
  - Revoking consent (`POST /api/parent/consent/revoke`) or disabling Live AI (`PATCH /api/parent/settings`) immediately terminates active child Live WebSocket sessions.
- **Explicit Guardian Consent & Audit Trail (`parent.ts`, `guardian_consent_events`):** Parent creation no longer auto-grants consent. Parents explicitly accept or revoke consent via `POST /api/parent/consent` and `POST /api/parent/consent/revoke`, recorded in `guardian_consent_events`. Child transcript storage respects `saveTranscripts` and `recordingRetentionDays`.
- **Abuse Controls & Anti-Farming (`rateLimit.ts`, `progressService.ts`, `learning.ts`, `voice.ts`):**
  - Sliding-window rate limits protect TTS, transcription (`audio/*` MIME allowlist + 3 MB decoded cap), AI coaching, Live tickets, AI-evaluated activities, and auth/reset routes.
  - Activity XP is awarded once per mastered activity (`learning_attempts.xp_awarded`); lesson completion verifies all lesson activities were attempted, computes scores server-side, clamps `minutesSpent`, awards `+40 XP` once per `(learner_id, lesson_id)`, and awards achievement XP atomically.
- **Auth & API Hardening (`app.ts`, `auth.ts`, `admin.ts`):** Security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`), mutating API origin checks, `512kb` default JSON body limit (`5mb` only on `/api/voice/transcribe`), atomic single-use password resets, admin self-demotion guard, and safe user projections (excluding `passwordHash`).

---

## Database Schema & Migrations

The PostgreSQL schema is defined in `src/db/schema.ts` and configured for Drizzle Kit in `src/db/drizzle.config.ts` (targeting `public` schema via `SQL_HOST`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, and `SQL_ADMIN_PASSWORD`).

To push schema changes non-destructively to PostgreSQL:

```bash
npx drizzle-kit push --config=src/db/drizzle.config.ts
```

Key additive security & child-safety schema elements:
- `parent_profiles.consent_version` (`varchar(40)`) & `parent_profiles.consent_revoked_at` (`timestamp`): supports explicit guardian consent and revocation tracking without auto-granting consent on account creation.
- `guardian_consent_events`: immutable audit trail of guardian `accepted`, `revoked`, and `child_created` actions (`parent_id`, `actor_user_id`, `consent_version`, `ip_address`, `user_agent`, `metadata_json`, `created_at`).
- `learning_attempts.xp_awarded` & `learner_progress.xp_awarded`: ensures activity and lesson XP are awarded once per mastered activity or completed lesson (`ON CONFLICT DO NOTHING` / atomic SQL `xp + delta` updates).

---

## Installation, Scripts & Verification

```bash
npm install
npm run lint     # TypeScript type-check (tsc --noEmit)
npm test         # Run automated security & integration tests (tsx --test tests/*.test.ts)
npm run build    # Production Vite frontend build (outputs dist/)
npm run dev      # Starts Express + Vite + Live WebSocket server on port 3000
npm start        # Starts server directly via tsx server.ts
```

### Automated Test Suite Summary

All **20 / 20** tests pass (`npm test` against `createSautiApp()`, `attachLiveVoiceWebSocket`, and Cloud SQL PostgreSQL, with test rows cleaned up on teardown):

| Test File | Tests | Scope Verified |
| --- | --- | --- |
| `tests/security-unit.test.ts` | 7 | Origin allowlist, non-revoked guardian consent logic, under-13/teen Live safety rules, environment transitions & adult course isolation, transcript retention/opt-out rules, single-use/expiring/origin-bound Live tickets, sliding-window `429` rate limiting |
| `tests/ownership-idor.test.ts` | 8 | Learner self-access, cross-learner IDOR (`404` uniform), parent access to nullable-`userId` child, cross-parent IDOR, unauthenticated `401` rejections, teacher classroom IDOR, admin safe role responses & self-demotion block, atomic single-use password reset |
| `tests/websocket-childsafety-consent.test.ts` | 3 | Under-13 individual registration block, explicit guardian consent grant/revoke + `guardian_consent_events` audit rows, Live gating across `little_voices`/`young_explorers`/`teen_voices`, adult mode/course/environment promotion blocks, WS pre-upgrade `401`/`403` checks, single-use ticket consumption, immediate WS termination on consent revocation |
| `tests/xp-ratelimit-validation.test.ts` | 2 | Premature lesson completion block (`400`), repeat activity/lesson/achievement XP anti-farming, cross-origin CSRF rejection (`403`), TTS/dialogue bounds, transcribe MIME allowlist & 3 MB size enforcement (`400`/`413`), TTS `429` rate limit |

---

## Production Deployment Requirements

1. **Strict Session Secret (`SESSION_SECRET`):** When `NODE_ENV=production`, `server/config/env.ts` refuses to start if `SESSION_SECRET` is missing, shorter than 16 characters, or matches known placeholder values (`change-this-session-secret-in-production`, `sauti-dev-session-secret-change-in-prod`). Generate a high-entropy secret (`openssl rand -base64 32`).
2. **Permitted Origins (`APP_URL`, `ALLOWED_ORIGINS`):** Set `APP_URL` to the public HTTPS deployment URL and `ALLOWED_ORIGINS` to any additional trusted origins. Mutating API requests (`POST`/`PUT`/`PATCH`/`DELETE`) and `/ws/live` WebSocket upgrades enforce origin validation.
3. **Database Connectivity & Schema:** Ensure Cloud SQL PostgreSQL (`SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`) is reachable and schema is synced via `src/db/schema.ts`.
4. **Server-Side Gemini & Firebase Config:** Provide `GEMINI_API_KEY` on the server (never in `VITE_*` variables) and configure Firebase Authentication for Google Sign-In (`firebase-applet-config.json`).
5. **Build & Start Sequence:**
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```
   In production (`NODE_ENV=production`), `server.ts` mounts `createSautiApp()`, serves the static bundle from `dist/` with SPA fallback, and attaches `/ws/live` on port `3000` (or `PORT`).
6. **Child Safety & Multi-Instance Scaling Note:**
   - Voice recordings are processed transiently for transcription and never stored permanently as raw audio files.
   - Pronunciation Coach compares speech-to-text transcripts against target text word-by-word without fabricating acoustic phonetic percentages.
   - When `GEMINI_API_KEY` is absent, TTS falls back transparently to browser `speechSynthesis` and Live Conversations enter clearly labelled Demo Mode.
   - `liveTicketService` and `rateLimit` store ephemeral state in process memory; multi-instance deployments behind a load balancer should back those stores with Redis or PostgreSQL.

