# MiniMax Lightweight Browser Test UI

## Summary
- Build a single-page `React + TypeScript` app with `Vite`, served locally in the browser with `vite --host 127.0.0.1 --port 4173`.
- Keep it fully client-side. No proxy, no backend, no auth server, no callbacks. MiniMax is called directly from the browser.
- Default API host to `https://api.minimaxi.com/v1`, with preset switching for `https://api.minimax.io/v1` and a custom host field.
- Persist the API key in `localStorage` exactly as requested. Persist threads/settings/media locally in browser storage.
- Support `Text`, `Image`, and `Video` in one slim chat UI, with a compact composer and an on-demand advanced drawer.

## Product Shape
- Layout: narrow left sidebar for local threads, centered transcript, sticky bottom composer, minimal top bar.
- Visual direction: dark graphite canvas, thin borders, muted blue accent, `IBM Plex Sans` for UI and `JetBrains Mono` for metrics/meta.
- Main composer controls always visible: mode switch, model dropdown, stream toggle for text, `Advanced` button, send/generate button.
- Non-default parameters appear as compact summary chips under the composer so the UI stays clean without hiding state.
- Text, image, and video results all appear inline in the same thread as message/job cards.
- Video scope for v1 is exactly `Text-to-Video` and `Image-to-Video`. Exclude first/last-frame and subject-reference video.
- Image scope for v1 includes both `Text-to-Image` and `Image-to-Image`, because they share one endpoint and minimal extra UI.

## Architecture
- Runtime deps: `react`, `react-dom`, `react-markdown`, `remark-gfm`, `idb`.
- Dev deps: `vite`, `typescript`, `@vitejs/plugin-react-swc`, `vitest`, `@testing-library/react`, `jsdom`.
- No router, no Redux/Zustand, no UI kit, no Tailwind.
- Proposed file layout:
- `src/main.tsx`
- `src/App.tsx`
- `src/styles.css`
- `src/types.ts`
- `src/lib/storage.ts`
- `src/lib/telemetry.ts`
- `src/lib/minimax/base.ts`
- `src/lib/minimax/catalog.ts`
- `src/lib/minimax/text-openai.ts`
- `src/lib/minimax/text-m2her.ts`
- `src/lib/minimax/image.ts`
- `src/lib/minimax/video.ts`
- `src/components/Sidebar.tsx`
- `src/components/Transcript.tsx`
- `src/components/Composer.tsx`
- `src/components/AdvancedDrawer.tsx`
- `src/components/TelemetryFooter.tsx`

## Public Interfaces / Internal Types
- `AppSettings`: `apiBaseUrl`, `apiKey`, `activeMode`, `streamText`, `rememberKey=true`, `showReasoning`, `theme='dark'`.
- `Thread`: `id`, `title`, `createdAt`, `updatedAt`, `items`, `drafts`, `textConfig`, `imageConfig`, `videoConfig`.
- `ThreadItem`: `id`, `kind`, `mode`, `status`, `request`, `response`, `telemetry`, `error`, `createdAt`.
- `TextConfig`: `backend`, `model`, `systemPrompt`, `temperature`, `topP`, `maxTokens`, `reasoningSplit`, `toolsJson`, `toolChoice`, `extraBodyJson`.
- `ImageConfig`: `variant`, `model`, `prompt`, `aspectRatio`, `width`, `height`, `responseFormat`, `seed`, `n`, `promptOptimizer`, `subjectReferences`.
- `VideoConfig`: `variant`, `model`, `prompt`, `duration`, `resolution`, `promptOptimizer`, `fastPretreatment`, `firstFrameImage`.
- `Telemetry`: `requestStartedAt`, `headersAt`, `firstTokenAt`, `completedAt`, `ttfbMs`, `ttftMs`, `generationMs`, `latencyMs`, `promptTokens`, `completionTokens`, `totalTokens`, `tokensPerSecond`, `approximate`, `requestId`, `responseId`.

## Storage
- `localStorage` holds API key and lightweight settings under versioned keys like `mmui:v1:settings`.
- `IndexedDB` holds threads, message history, generated image blobs, uploaded reference images, and cached video metadata.
- Generated images default to `response_format='base64'`, then are converted to blobs and stored in IndexedDB so thread history survives the 24h URL expiry.
- Videos store `task_id`, `file_id`, `download_url`, and expiry metadata. Do not auto-store MP4 blobs by default.
- On thread reload, if a video `download_url` is missing or expired, re-resolve it from `file_id` via file retrieval.

## API Strategy
- On API key entry or host change, attempt `GET {baseUrl}/models` once.
- If discovery returns `404` or unsupported payload, switch to a documented static catalog and show `Static catalog` in the UI.
- Do not pre-block unsupported models by plan; let the endpoint return the real error, then render that error in the thread card.

## Model Catalogs
- Text OpenAI-compatible: `MiniMax-M2.7`, `MiniMax-M2.7-highspeed`, `MiniMax-M2.5`, `MiniMax-M2.5-highspeed`, `MiniMax-M2.1`, `MiniMax-M2.1-highspeed`, `MiniMax-M2`.
- Text native: `M2-her`.
- Image T2I: `image-01`.
- Image I2I: `image-01`, `image-01-live`.
- Video T2V: `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-02`, `T2V-01-Director`, `T2V-01`.
- Video I2V: `MiniMax-Hailuo-2.3`, `MiniMax-Hailuo-2.3-Fast`, `MiniMax-Hailuo-02`, `I2V-01-Director`, `I2V-01-live`, `I2V-01`.

## Request/Response Handling
- Text primary path uses `POST /chat/completions` with raw `fetch`, SSE streaming parser, and full assistant-message preservation in history.
- `M2-her` uses `POST /text/chatcompletion_v2` with its native payload and native usage block.
- If text returns `reasoning_details`, render it in a collapsible `Thinking` block above the assistant answer.
- If text returns `tool_calls`, render the raw tool call JSON and preserve it in history, but do not execute tools in v1.
- Image requests use `POST /image_generation`; I2I reference images are sent as Data URLs to stay browser-only.
- Video requests use `POST /video_generation`, then poll `GET /query/video_generation` every 2500ms until `Success` or `Fail`, then call `GET /files/retrieve` for `download_url`.

## Telemetry Rules
- Append telemetry to every assistant/job card footer in a compact mono line.
- Text streaming footer shows exact `ttfb`, `ttft`, `generation`, `latency`, `tok/sec`, `prompt`, `completion`, `total`, `model`, `requestId`.
- `tok/sec` formula in streaming mode: `completion_tokens / ((lastTokenAt - firstTokenAt) / 1000)`.
- Non-stream text uses the user-approved approximate path: `ttft≈latencyMs` and `tok/sec≈completion_tokens / (latencyMs / 1000)`, marked with `~`.
- Image footer shows `model`, `n`, `aspect`, `seed`, `latency`, `success_count`, `failed_count`, `requestId`.
- Video footer shows `model`, `duration`, `resolution`, `queue/poll time`, `total latency`, `status`, `video dimensions`, `file_id`, `requestId`.

## Error and Edge Handling
- Show API errors inline as thread cards with status code, message, and raw JSON in a collapsible panel.
- Preserve the user prompt and settings even when generation fails.
- Validate uploads locally for MIME type and size before request.
- When the selected model changes across backends, swap the parameter schema automatically and keep only compatible fields.
- For unsupported-model or unsupported-plan responses, keep the dropdown unchanged and surface the endpoint error exactly.

## Testing and Acceptance
- Unit tests: storage versioning, static-catalog fallback, telemetry math, SSE parsing, request builders, video polling state transitions.
- Manual smoke test: save API key, reload, confirm persistence, confirm static catalog badge after `/models` fallback.
- Manual text test: one streaming `MiniMax-M2.7` chat, one non-stream chat, one `M2-her` chat, all with telemetry footer rendered.
- Manual image test: one T2I request and one I2I request with local reference image; reload and confirm images still render from IndexedDB.
- Manual video test: one T2V and one I2V job; confirm pending card, polling, success transition, playback, and re-fetch of expired URL.
- Manual error test: force an unsupported model/host combination and confirm inline error rendering without UI breakage.

## Assumptions and Locked Defaults
- Default host is `https://api.minimaxi.com/v1` because the user reported plan compatibility there, and browser CORS was locally validated on `2026-04-02`.
- `https://api.minimax.io/v1/models` and `https://api.minimaxi.com/v1/models` both returned `404` during local checks on `2026-04-02`, so static model catalogs are the expected path.
- The app intentionally stores the API key in plain `localStorage`; this is a deliberate local-machine tradeoff, not an accident.
- The app is intentionally single-user, local-only, and disposable; no backend hardening, no multi-user auth, no SSR, no deployment abstraction.
- Tool execution, speech/music APIs, video callbacks, and MiniMax MCP integration are out of scope for v1.

## References
- [MiniMax API Overview](https://platform.minimax.io/docs/api-reference/api-overview)
- [MiniMax MCP Guide](https://platform.minimax.io/docs/mcp)
- [Compatible OpenAI API](https://platform.minimax.io/docs/api-reference/text-openai-api)
- [Text Chat / M2-her](https://platform.minimax.io/docs/api-reference/text-chat)
- [Text-to-Image](https://platform.minimax.io/docs/api-reference/image-generation-t2i)
- [Image-to-Image](https://platform.minimax.io/docs/api-reference/image-generation-i2i?key=68ac02076602726333ffd28f)
- [Text-to-Video](https://platform.minimax.io/docs/api-reference/video-generation-t2v)
- [Image-to-Video](https://platform.minimax.io/docs/api-reference/video-generation-i2v)
- [Query Video Generation Status](https://platform.minimax.io/docs/api-reference/video-generation-query)
- [Retrieve File](https://platform.minimax.io/docs/api-reference/file-management-retrieve?key=68b56abca96516e26019203a)
