# Project Guidelines & Conventions

> Comprehensive grounding documentation for the MiniMax WebUI project.
> Referenced by issue #10 and PR #5.

---

## 1. Architecture Overview

```
src/
  main.tsx                   React entry point
  App.tsx                    App shell — owns ALL state, routes between modes
  types.ts                   All shared TypeScript interfaces and types
  styles.css                 Global vanilla CSS
  components/
    Sidebar.tsx              Thread list + brand + new-thread control
    Transcript.tsx           Message history display (text/image/video)
    Composer.tsx             Input bar (mode selector, model, prompt, uploads)
    AdvancedDrawer.tsx       Per-request parameter controls (overlay panel)
    TelemetryFooter.tsx      Timing metrics display per item
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

**Data flow:** `App.tsx` dispatches calls into `src/lib/minimax/` clients → streams/polls MiniMax API → returns results. `storage.ts` persists threads and media blobs to IndexedDB.

---

## 2. React Component Rules

### ⛔ Never define components inside other components

Inner components get a new function identity on every parent render, causing React to unmount/remount their entire DOM subtree. This destroys focus, selection, scroll position, and any local state.

```tsx
// ❌ WRONG — causes input focus loss during streaming
function App() {
  const Layout = () => <div>...</div>;  // remounts every render!
  return <Layout />;
}

// ✅ CORRECT — stable identity, preserves DOM state
function Layout(props: LayoutProps) { return <div>...</div>; }
function App() { return <Layout {...props} />; }
```

### Component Placement Rules

- **All components** defined at **module scope** (top-level of their file)
- When a layout/sub-component needs parent state, accept it as **explicit props**
- Do **not** use closures over parent state to avoid identity instability
- Helper render functions (e.g., `renderTextItem()`) that return JSX fragments are acceptable since they're not components — they don't have hooks or identity

---

## 3. Code Style

- **TypeScript strict mode** throughout; no `any`, no type assertions without justification
- **Vanilla CSS** in `src/styles.css`; no Tailwind, no CSS-in-JS, no UI component library
- **React state only** — no Redux, Zustand, Jotai, or any state management library
- **Named exports** preferred; default exports only for the root `App` component
- **ESM throughout** (`"type": "module"` in package.json)
- No linter or formatter is configured — do not add one without discussion

---

## 4. Layout Architecture

The app uses a **2-column CSS Grid** layout:

- **Left column**: Sidebar (thread list, new-thread button)
- **Right column**: Main pane (topbar + transcript + composer)
- **Advanced drawer**: Collapsible overlay from the right for per-request parameters

---

## 5. Settings & Persistence

**localStorage** (`mmui:v1:settings`):

- API base URL, API key, active mode, stream toggle, reasoning toggle, theme

**IndexedDB** (`mmui:v1`):

- `threads` store: Thread objects (serialized without blob URLs)
- `assets` store: Binary blobs (images, first frames)

---

## 6. Build & Test

```sh
npm install
npm run dev        # dev server at http://127.0.0.1:4173
npm run build      # tsc --noEmit && vite build → dist/
npm test           # vitest run (12 tests across 5 files)
```

The build step type-checks first. Fix all TypeScript errors before the Vite bundle step runs.

---

## 7. PR Guidelines

Before opening a PR, verify both pass locally:

```sh
npm run build   # type-check + bundle
npm test        # full test suite
```

- No enforced commit message format
- Keep changes focused; build and tests must remain green
- **DO NOT** add security measures (CORS, CSP, SSRF) — this is a local dev tool
- **DO NOT** add new dependencies without compelling justification

---

## 8. Design Principles

- **Dark-first**: The default theme is dark. No light mode.
- **Developer-oriented**: Small fonts, compact spacing
- **Space-efficient**: Sidebar toggleable, drawer as overlay
- **No CDN dependencies**: All assets should be served from local paths when possible

---

## 9. Agent & MCP Toolset Limitations

When working with AI coding agents (e.g., GitHub Copilot) on this repository, note the following MCP (Model Context Protocol) toolset constraints:

### Available Capabilities

- **Code search and navigation**: Agents can search code, read files, and explore the repository structure
- **Code editing**: Agents can create and edit files, run builds, and execute tests
- **GitHub integration**: Agents can read issues, pull requests, commits, and workflow runs
- **Pull request workflow**: Agents can create branches, commit changes, and open/update PRs

### Unavailable Capabilities

- **Direct issue creation**: Agents cannot create GitHub issues via MCP tools — issues must be created manually by repository maintainers
- **Direct issue modification**: Agents cannot close, label, or assign issues programmatically
- **Repository settings**: Agents cannot modify repository configuration, branch protection rules, or webhooks
- **External API calls**: Agents cannot make live calls to the MiniMax API or any external service for testing

### Best Practices for Agent-Assisted Development

1. **Reference issues by number** in commits and PR descriptions rather than attempting to create or modify them
2. **Run `npm run build` and `npm test`** before submitting changes to verify correctness
3. **Keep changes focused** — one logical change per PR
4. **Document decisions** in PR descriptions and code comments, not in transient issue comments
5. **Use existing test patterns** when adding new test coverage (test files live next to source: `foo.test.ts` alongside `foo.ts`)

---

## 10. Model Catalogs

- Text OpenAI-compatible: `MiniMax-M2.7`, `MiniMax-M2.7-highspeed`, `MiniMax-M2.5`, `MiniMax-M2.5-highspeed`, `MiniMax-M2.1`, `MiniMax-M2.1-highspeed`, `MiniMax-M2`
- Text native: `M2-her`
- Image T2I: `image-01`
- Image I2I: `image-01`, `image-01-live`
- Video T2V: `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01`
- Video I2V: `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `MiniMax-Hailuo-02`, `I2V-01-Director`, `I2V-01-live`, `I2V-01`

---

## 11. Assumptions and Locked Defaults

- Default host is `https://api.minimaxi.com/v1` because the user reported plan compatibility there, and browser CORS was locally validated.
- `https://api.minimax.io/v1/models` and `https://api.minimaxi.com/v1/models` both returned `404` during local checks, so static model catalogs are the expected path.
- The app intentionally stores the API key in plain `localStorage`; this is a deliberate local-machine tradeoff, not an accident.
- The app is intentionally single-user, local-only, and disposable; no backend hardening, no multi-user auth, no SSR, no deployment abstraction.
- Tool execution, speech/music APIs, video callbacks, and MiniMax MCP integration are out of scope for v1.

---

## 12. References

- [MiniMax API Overview](https://platform.minimax.io/docs/api-reference/api-overview)
- [MiniMax MCP Guide](https://platform.minimax.io/docs/mcp)
- [Compatible OpenAI API](https://platform.minimax.io/docs/api-reference/text-openai-api)
- [Text Chat / M2-her](https://platform.minimax.io/docs/api-reference/text-chat)
- [Text-to-Image](https://platform.minimax.io/docs/api-reference/image-generation-t2i)
- [Image-to-Image](https://platform.minimax.io/docs/api-reference/image-generation-i2i)
- [Text-to-Video](https://platform.minimax.io/docs/api-reference/video-generation-t2v)
- [Image-to-Video](https://platform.minimax.io/docs/api-reference/video-generation-i2v)
- [Query Video Generation Status](https://platform.minimax.io/docs/api-reference/video-generation-query)
