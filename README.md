# Hermes

Forked from [dearhermes.com](https://dearhermes.com) — built on the Dignified Technology design philosophy.

A local-first AI writing tool that structures your thinking without doing the writing for you.

Write in a 5-tab markdown editor, get streamed chat feedback with inline highlights. Bring your own Anthropic or OpenAI API key — no accounts, no cloud, no tracking.

## Download

**[Hermes v0.2.0](https://github.com/inosaint/hermes/releases/tag/v0.2.0)** — macOS (Apple Silicon)

> The app is unsigned. Right-click → Open to bypass Gatekeeper on first launch.

## Features

- **Multi-project support** — create, rename, and switch between independent writing projects
- **TipTap markdown editor** with 5 tabbed pages (Coral, Amber, Sage, Sky, Lavender) per project
- **AI assistant** chat with inline highlights and source citations
- **BYOK** — use your own Anthropic or OpenAI API keys
- **Model selector** — Claude Sonnet 4.6, Haiku 4.5, Opus 4.6, GPT-4o, GPT-4o Mini
- **Workspace folders** — drafts saved as markdown files on disk, per project
- **Persistent chat** — chat history saved per project and restored across sessions
- **Focus mode** for distraction-free writing
- **Markdown support** — paste markdown, use shortcuts, or write with standard syntax

## How It Works

On first launch, Hermes creates a workspace folder at `~/Documents/Hermes`. Each project gets its own subfolder with markdown files for each tab and a `chat.json` for chat history. Existing folders in the workspace are automatically imported as projects.

```
~/Documents/Hermes/
├── My First Project/
│   ├── coral.md
│   ├── amber.md
│   ├── sage.md
│   ├── sky.md
│   ├── lavender.md
│   └── chat.json
├── Essay Draft/
│   └── ...
```

You can change the workspace folder in Settings → Workspace.

## Architecture

- `apps/web` — React 19 + Vite frontend
- `server` — Express 5 SSE assistant API (stateless proxy)
- `apps/native/src-tauri` — Tauri 2 shell that bundles the server as a sidecar
- `packages/api` — shared types and welcome seed content

No database. API keys are stored locally on-device and sent per-request.

## Prerequisites

- Node.js 22 (see `.node-version`)
- npm (comes with Node)
- Rust + Cargo (for native builds only)

```bash
# Install Rust (macOS / Linux)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

For full Tauri platform requirements, see [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/).

## Quick Start

```bash
npm install
npm run dev
```

This starts the frontend at `http://localhost:5176` and the server at `http://127.0.0.1:3003`.

1. Open Settings (gear icon in the top bar)
2. Add your Anthropic and/or OpenAI API key → Save
3. Select a model in the chat input area and start writing

## Native Desktop (Tauri)

```bash
npm run native:dev             # Dev mode (rebuilds sidecar + Tauri)
npm run native:dev:fast        # Dev mode (skip sidecar rebuild)
npm run native:dev:debugtools  # Dev mode with DevTools enabled
npm run native:build           # Production build (.app + .dmg)
```

## Environment Variables

Server env file: `server/.env` (all optional for local dev)

```bash
FRONTEND_URL=http://localhost:5176
HOST=127.0.0.1
PORT=3003
LOG_LEVEL=info
SENTRY_DSN=
NODE_ENV=development
```

No API keys in server env — they come from the client per-request.

## Quality Checks

```bash
npm run lint
npm run server:typecheck
npm run web:build
```

## License

See [LICENSE](LICENSE) for details.
