# MiniMax WebUI

A browser-only single-page application for interacting with the [MiniMax AI API](https://platform.minimax.io/docs/api-reference/api-overview). Supports text chat (OpenAI-compatible and native M2-her endpoints), image generation (text-to-image and image-to-image), and video generation (text-to-video and image-to-video with async polling).

**Stack:** React 19, TypeScript 5.9 (strict), Vite 7, Vitest 4, vanilla CSS

**Architecture:** Zero backend — the browser calls the MiniMax API directly. No router, no global state management library. Persistence is split: `localStorage` for settings/API key, IndexedDB (via `idb`) for conversation threads and media blobs.

## Quick Start

```sh
npm install
npm run dev        # dev server at http://127.0.0.1:4173
```

Set your MiniMax API key in the UI settings — it is stored in `localStorage` and never leaves the browser.

## Build

```sh
npm run build      # runs tsc --noEmit then vite build; output goes to dist/
```

## Test

```sh
npm test           # vitest run
```

## Documentation

- [`AGENTS.md`](AGENTS.md) — agent instructions, project structure, and coding conventions
- [`project_guidelines.md`](project_guidelines.md) — detailed project guidelines, component rules, and MCP toolset limitations
- [`PLAN.md`](PLAN.md) — implementation plan and feature checklist

## License

See [LICENSE](LICENSE).
