# RailDesign AI

Full-stack AI creative & engineering platform powered by six independent engines, multi-provider AI routing, an atomic token wallet, Cashfree payment verification, isolated live previews, binary GIF89a & ZIP export, sharing, publishing, and role-based administration.

---

## Architecture Overview

- **Frontend**: React 19, Vite, Tailwind CSS v4, Motion (`framer-motion` / `motion`), Lucide Icons.
- **Backend**: Express + TypeScript (`server.ts`) with Vite SSR/middleware in dev and static asset serving in production.
- **Database**: Embedded SQLite (`node:sqlite` WAL mode) out-of-the-box with zero external setup, plus PostgreSQL schema & migrations (`migrations/001_initial_postgres.sql`) and `pg` connection pooling when `DATABASE_URL` is configured.
- **Six Independent AI Engines** (`src/server/engines/`):
  1. `engine01-website.ts` — Website Design Engine (multi-page HTML/CSS/JS/React generation)
  2. `engine02-app-uiux.ts` — App & UI/UX Engine (SaaS dashboards, mobile flows, auth screens, design systems)
  3. `engine03-graphic-image.ts` — Image & Graphic Design Engine (native Gemini/OpenAI image gen + vector SVG compositions & reference analysis)
  4. `engine04-coding.ts` — AI Coding Engine (React, TypeScript, Express APIs, debugging & refactoring)
  5. `engine05-animation-gif.ts` — Animation & GIF Engine (frame choreography + binary `GIF89a` encoder via `gifenc`)
  6. `engine06-testing-export.ts` — Testing & Export Engine (static validation, responsive auto-fixes, verified ZIP bundling via `jszip`)
- **Three AI Provider Adapters** (`src/server/providers/`):
  - Google Gemini (`@google/genai`)
  - OpenAI — ChatGPT Models
  - Anthropic — Claude Models

---

## 1. Installation Instructions

```bash
npm install
cp .env.example .env
npm run dev
```

The platform runs on `http://localhost:3000`.

---

## 2. Database Setup Instructions

- **Default (Zero-Config)**: Uses Node 22 built-in SQLite (`data/raildesign.db` in WAL mode) and creates all 19 tables automatically on startup.
- **PostgreSQL (Production)**:
  1. Set `DATABASE_URL=postgres://user:password@host:5432/raildesign_ai` in `.env`.
  2. Apply the initial migration:
     ```bash
     psql "$DATABASE_URL" -f migrations/001_initial_postgres.sql
     ```
  3. Or launch both PostgreSQL and the app via Docker Compose:
     ```bash
     docker compose up --build
     ```

---

## 3. AI API Configuration

Configure server-side provider keys in `.env` or your hosting secrets panel (never exposed to browser code):

- `GEMINI_API_KEY` — Google Gemini (`gemini-4-hydrogen`, `gemini-4-neon`, `gemini-4-carbon`, `gemini-3.1-flash-lite-image`)
- `OPENAI_API_KEY` — OpenAI (`gpt-4.1`, `gpt-4.1-mini`, `o3-mini`, `gpt-image-1`)
- `ANTHROPIC_API_KEY` — Anthropic (`claude-sonnet-4-20250514`, `claude-3-7-sonnet-20250219`, `claude-3-5-haiku-20241022`)

---

## 4. OAuth Setup (Google & GitHub)

1. Set `APP_URL` to your deployed base URL (e.g. `https://your-app.run.app`).
2. Register the following callback URLs in your OAuth developer consoles:
   - **Google OAuth**: `<APP_URL>/auth/callback/google`
   - **GitHub OAuth**: `<APP_URL>/auth/callback/github`
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, and `GITHUB_CLIENT_SECRET` on the server.

---

## 5. Cashfree Payment Configuration

- **Cashfree Payments**:
  - Set `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, and `CASHFREE_ENV=sandbox` (or `production`).
  - Configure Cashfree webhook endpoint to `POST <APP_URL>/api/webhooks/cashfree` (verified via HMAC-SHA256 `x-webhook-signature`).
  - When Cashfree keys are omitted, the server runs a cryptographic HMAC sandbox verification flow so checkout remains testable without exposing fake credits.

---

## 6. Automated Test Suite

```bash
npm test
npm run lint
npm run build
```

Note: Live upstream LLM calls against Gemini, OpenAI, and Anthropic require valid `GEMINI_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` values in the environment. All auth, RBAC, token ledger, Cashfree verification, GIF89a encoding, ZIP verification, sharing, and publishing tests execute hermetically in `tests/platform.test.ts`.

---

## 7. Deployment Instructions

```bash
npm run build
NODE_ENV=production npm start
```

Or deploy with Docker:

```bash
docker build -t raildesign-ai .
docker run -p 3000:3000 --env-file .env raildesign-ai
```
