# SAUTI — Voice-First English Learning Platform

> **"Don't just learn English. Find your voice."**
> *"Speak with confidence. Learn at your own pace."*

SAUTI is a full-stack, voice-first English learning ecosystem built for learners of every age—from early childhood (`Little Voices`, ages 3–5) to `Lifelong English` (ages 46+)—with independent CEFR proficiency pathways (`A1`–`C2`), age-tailored application layouts, a 4-mode Voice Studio powered by Gemini Live API / TTS / Transcription, and dedicated Parent, Teacher, and Admin portals.

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Motion for React, Lucide React, Zustand, React Hook Form + Zod, Firebase Auth (`signInWithPopup` Google Sign-In)
- **Backend:** Node.js, Express, TypeScript (`tsx`), WebSockets (`ws`)
- **Database:** Cloud SQL for PostgreSQL + Drizzle ORM (`src/db/schema.ts`)
- **AI & Voice:** `@google/genai` (configurable models: `gemini-4-hydrogen`, `gemini-3.8-flash-lite-tts`, `gemini-3.8-flash-tts`, `gemini-3.5-transcribe`, `gemini-3.8-live`)

---

## Project Structure

```text
├── server.ts                  # Express + Vite middleware + Live WebSocket server
├── server/
│   ├── config/env.ts          # Environment & configurable Gemini model IDs
│   ├── middleware/auth.ts     # Firebase ID token + HMAC session verification & RBAC
│   ├── routes/                # auth, learning, voice, parent, teacher, admin REST APIs
│   ├── services/              # authService, aiVoiceService, seedService
│   └── ws/liveVoiceServer.ts  # /ws/live Gemini Live API WebSocket bridge
├── src/
│   ├── app/layouts/           # KidsLayout, TeenLayout, AdultLayout, PortalLayout
│   ├── components/            # PublicHeader, ResilientImage, ActivityRunner (15 types)
│   ├── db/                    # Drizzle schema, connection pool, drizzle.config.ts
│   ├── hooks/                 # useAudioRecorder (MediaRecorder), useSpeechPlayback
│   ├── lib/                   # firebase.ts (client), firebase-admin.ts (server)
│   ├── pages/                 # marketing, auth, onboarding, learner, voice, parent, teacher, admin
│   ├── services/              # Typed API client
│   ├── stores/                # Zustand authStore
│   ├── types/                 # Shared TypeScript interfaces
│   └── utils/                 # Age environment tokens & asset constants
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
- `SESSION_SECRET`: HMAC signing key for email/password sessions
- `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`: Runtime Cloud SQL PostgreSQL pool credentials
- `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`: Drizzle Kit schema management credentials

---

## Installation & Development

```bash
npm install
npm run lint     # TypeScript type-check (tsc --noEmit)
npm run build    # Production Vite frontend build
npm run dev      # Starts Express + Vite + Live WebSocket server on port 3000
```

## Child Safety & Accuracy Notes

- Children in `Little Voices` and `Young Explorers` require guardian consent, have no public profiles or open messaging, and respect parent toggles for Live AI conversation access.
- Voice recordings are processed transiently for transcription without permanent raw audio storage.
- Pronunciation Coach compares speech-to-text transcripts against target text word-by-word and explicitly avoids fabricating acoustic phonetic percentages.
- When `GEMINI_API_KEY` is absent, TTS falls back transparently to browser `speechSynthesis` and Live Conversations enter clearly labelled Demo Mode.
