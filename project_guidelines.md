# Project Guidelines & Conventions

> **Padawan's Codex**: _"The Light Side of the Code demands discipline, clarity, and humility.
> Document what you broke, how you broke it, and how you crawled back."_

---

## 1. Version Tagging (MANDATORY)

Every release **must** increment the version tag. The tag appears in **two** places:
1. **Visible in the UI title**: `MiniMax v{N}` (rendered in `Sidebar.tsx` brand area)
2. **Hidden comment for machine parsing**: `{/* [[<<CURRENT VERSION TAG: {N}>>]] */}` (in `Sidebar.tsx`)

Format:
```
v1 → v2 → v3 …
```

Additionally, `src/styles.css` contains a header comment with `CURRENT_VERSION_TAG: {N}` and `index.html` `<title>` reflects the version.

**Current version: v1**

---

## 2. Architecture Overview

```
src/
  main.tsx                   React entry point
  App.tsx                    App shell — owns ALL state, routes between modes
  types.ts                   All shared TypeScript interfaces and types
  styles.css                 Global vanilla CSS (ALL 3 themes live here)
  components/
    Sidebar.tsx              Thread list + brand + new-thread control
    Transcript.tsx           Message history display (text/image/video)
    Composer.tsx             Input bar (mode selector, model, prompt, uploads)
    AdvancedDrawer.tsx       Per-request parameter controls (overlay panel)
    TelemetryFooter.tsx      Timing metrics display per item
    SettingsModal.tsx         API settings modal (host, key, reasoning)
    ThemeSwitcher.tsx         Theme 1/2/3 hot-swap buttons (lower-right)
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

## 3. Theme System

Three dark themes, hot-swappable via CSS custom properties on `[data-theme]`:

| ID | Name | Character |
|----|------|-----------|
| `midnight` | Midnight | Cool blue-slate, VS Code inspired (default) |
| `ember` | Ember | Warm amber/brown tones |
| `abyss` | Abyss | Deep navy with teal accents |

**Implementation:**
- CSS variables defined per theme in `styles.css` via `[data-theme="..."]` selectors
- `App.tsx` applies `data-theme` to `document.documentElement` via `useEffect`
- `ThemeSwitcher` component renders 1/2/3 buttons in fixed lower-right corner
- Theme preference persists in `AppSettings.theme` via localStorage

**To add a new theme:**
1. Add the theme ID to `Theme` type in `types.ts`
2. Add `VALID_THEMES` entry in `storage.ts`
3. Add `[data-theme="newtheme"]` CSS block in `styles.css`
4. Add entry in `ThemeSwitcher.tsx` THEMES array

---

## 4. React Component Rules (CRITICAL)

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

## 5. Code Style

- **TypeScript strict mode** throughout; no `any`, no type assertions without justification
- **Vanilla CSS** in `src/styles.css`; no Tailwind, no CSS-in-JS, no UI component library
- **React state only** — no Redux, Zustand, Jotai, or any state management library
- **Named exports** preferred; default exports only for the root `App` component
- **ESM throughout** (`"type": "module"` in package.json)
- **System font stacks** — no CDN font imports; fonts resolve locally
- No linter or formatter is configured — do not add one without discussion

---

## 6. Layout Architecture

The app uses a **2-column CSS Grid** layout:

```
.app-shell {
  grid-template-columns: 240px minmax(0, 1fr);
}
```

- **Left column**: Sidebar (collapsible via `app-shell--sidebar-collapsed` class)
- **Right column**: Main pane (topbar + transcript + composer)
- **Advanced drawer**: Always a fixed overlay from the right (z-index 20)
- **Settings modal**: Full-screen backdrop overlay (z-index 50)
- **Theme switcher**: Fixed bottom-right (z-index 30)

Sidebar toggle: `☰` button in topbar sets `sidebarOpen` state, which toggles `app-shell--sidebar-collapsed` CSS class.

---

## 7. Settings & Persistence

**localStorage** (`mmui:v1:settings`):
- API base URL, API key, active mode, stream toggle, reasoning toggle, theme

**IndexedDB** (`mmui:v1`):
- `threads` store: Thread objects (serialized without blob URLs)
- `assets` store: Binary blobs (images, first frames)

Settings that were previously in the topbar (host, API key, reasoning) are now in the **SettingsModal** component, triggered by the ⚙ gear button.

---

## 8. Build & Test

```sh
npm install
npm run dev        # dev server at http://127.0.0.1:4173
npm run build      # tsc --noEmit && vite build → dist/
npm test           # vitest run (12 tests across 5 files)
```

The build step type-checks first. Fix all TypeScript errors before the Vite bundle step runs.

---

## 9. PR Guidelines

Before opening a PR, verify both pass locally:

```sh
npm run build   # type-check + bundle
npm test        # full test suite
```

- No enforced commit message format
- Keep changes focused; build and tests must remain green
- **DO NOT** add security measures (CORS, CSP, SSRF) — this is a local dev tool
- **DO NOT** add new dependencies without compelling justification
- **DO NOT** import fonts or assets from CDNs — everything must be local

---

## 10. Design Principles

- **Dark-first**: All themes are dark. No light mode. Never use bright greys or whites.
- **Developer-oriented**: Small fonts (13px base, 10-11px for metadata), compact spacing
- **VS Code / Cursor aesthetic**: Clean, lean, professional. Lots of visible text.
- **High DPI aware**: System fonts render crisply at all scales
- **Space-efficient**: Sidebar toggleable, settings in modal, drawer as overlay
- **No CDN dependencies**: All assets served from local path

---

## 11. Future Enhancement Ideas

These are proposed but **not implemented** — left for discussion:

1. **Keyboard shortcuts**: Ctrl+Enter to send, Ctrl+B to toggle sidebar, Ctrl+, for settings
2. **Thread search/filter**: Quick filter in sidebar for finding threads by title
3. **Export thread as JSON/Markdown**: Download conversation history
4. **Token cost estimation**: Show estimated API cost per request based on model pricing
5. **Response diff view**: Compare two responses side by side
6. **Persistent advanced drawer state**: Remember which drawer fields were expanded
7. **Drag-and-drop file upload**: Drop images directly onto the composer
