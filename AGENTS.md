# AGENTS.md

## Project Overview

MiniMax WebUI is a browser-only single-page application for interacting with the MiniMax AI API. It supports text chat (OpenAI-compatible and native M2-her endpoints), image generation (text-to-image and image-to-image), and video generation (text-to-video and image-to-video with async polling).

**Stack:** React 19, TypeScript 5.9 (strict), Vite 7, Vitest 4, vanilla CSS  
**Architecture:** Zero backend — the browser calls the MiniMax API directly. No router, no global state management library. Persistence is split: `localStorage` for settings/API key, IndexedDB (via `idb`) for conversation threads and media blobs.  
**Default API base:** `https://api.minimaxi.com/v1`

## Setup

```sh
npm install
npm run dev        # dev server at http://127.0.0.1:4173
```

Set your MiniMax API key in the UI settings panel — it is stored in `localStorage` and never leaves the browser.

## Build

```sh
npm run build      # runs tsc --noEmit then vite build; output goes to dist/
```

The build step type-checks first. Fix all TypeScript errors before the Vite bundle step runs.

## Testing

```sh
npm test                              # run all tests (vitest run)
npx vitest run src/lib/storage.test.ts   # run a single test file
npx vitest run -t "normalizes catalog"   # run tests matching a name pattern
```

- Test files live next to their source: `foo.test.ts` alongside `foo.ts`
- Test environment: jsdom (configured in `vite.config.ts`)
- Coverage areas: storage layer, catalog normalisation, SSE parsing, payload building, telemetry math, video status normalisation
- No linter or formatter is configured — do not add one without discussion

## Code Style

- **TypeScript strict mode** throughout; no `any`, no type assertions without justification
- **Vanilla CSS** in `src/styles.css`; no Tailwind, no CSS-in-JS, no UI component library
- **React state only** — no Redux, Zustand, Jotai, or any state management library
- **File organisation:** one capability per module under `src/lib/minimax/`; shared fetch/SSE helpers in `base.ts`; all TypeScript interfaces in `src/types.ts`
- Named exports preferred; default exports only for React components
- ESM throughout (`"type": "module"` in package.json)

## Architecture

```
src/
  main.tsx                   React entry point
  App.tsx                    App shell — owns all state, routes between modes
  types.ts                   All shared TypeScript interfaces and types
  styles.css                 Global vanilla CSS
  components/
    Sidebar.tsx              Thread list + new-thread controls
    Transcript.tsx           Message history display
    Composer.tsx             Input bar (text/image/video prompt)
    AdvancedDrawer.tsx       Per-request parameter controls
    TelemetryFooter.tsx      Timing metrics display
  lib/
    storage.ts               localStorage (settings) + IndexedDB (threads/media)
    telemetry.ts             TTFB, TTFT, tok/sec, latency calculations
    minimax/
      base.ts                Shared fetch + SSE streaming helpers
      catalog.ts             Static model catalog + runtime discovery
      text-openai.ts         OpenAI-compatible chat completions client
      text-m2her.ts          Native MiniMax M2-her chat client
      image.ts               Image generation client (T2I / I2I)
      video.ts               Video generation client + async status polling
```

**Data flow:** `App.tsx` dispatches calls into the appropriate `src/lib/minimax/` client, which streams or polls the MiniMax API and returns results. `storage.ts` persists threads and media blobs to IndexedDB and surfaces them on load.

## PR Guidelines

Before opening a PR, verify both of the following pass locally:

```sh
npm run build   # type-check + bundle
npm test        # full test suite
```

There is no enforced commit message format. Keep changes focused and ensure the build and test suite remain green.

## Agent Usage & MCP Toolset Limitations

AI coding agents working on this repository should be aware of the following constraints and conventions. For full project guidelines see [`project_guidelines.md`](project_guidelines.md).

### Available Agent Capabilities

- Read and search code, issues, pull requests, commits, and workflow runs
- Create and edit files, run builds (`npm run build`), and execute tests (`npm test`)
- Create branches, commit changes, and open or update pull requests

### Unavailable Agent Capabilities

- **Issue creation/modification** — agents cannot create, close, label, or assign GitHub issues via MCP tools; these actions must be performed manually
- **Repository settings** — agents cannot modify repo configuration, branch protection, or webhooks
- **External API calls** — agents cannot make live calls to the MiniMax API or other external services

### Agent Conventions

- Reference existing issues by number in commits and PR descriptions
- Run `npm run build && npm test` before submitting any changes
- Follow the component rules in `project_guidelines.md` — never define React components inside other components
- Keep PRs focused on a single logical change
- Test files live next to their source (`foo.test.ts` alongside `foo.ts`)
