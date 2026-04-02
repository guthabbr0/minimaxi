# MiniMax WebUI Plan And Checks

## Summary
- Status: implemented
- Stack: `Vite + React + TypeScript`
- Runtime shape: browser-only SPA, no backend, no proxy
- Default API host: `https://api.minimaxi.com/v1`
- Local persistence: `localStorage` for settings and API key, `IndexedDB` for threads and media assets

## Implemented Scope
- [x] Single-page slim WebUI with sidebar, transcript, composer, and advanced drawer
- [x] Text chat support for OpenAI-compatible MiniMax models
- [x] Native `M2-her` support via `/text/chatcompletion_v2`
- [x] Streaming and non-streaming text requests
- [x] Image generation support
- [x] Image-to-image support with locally stored reference uploads
- [x] Text-to-video support
- [x] Image-to-video support with first-frame upload or URL
- [x] Telemetry footer appended to every text, image, and video result card
- [x] Static model catalog fallback when `/models` is unavailable
- [x] Local thread persistence across reloads
- [x] Stored image asset hydration from IndexedDB on reload
- [x] Video download URL refresh flow for expired or missing URLs
- [x] Inline API error rendering without breaking the thread

## Architecture Checks
- [x] No router added
- [x] No Redux/Zustand added
- [x] No UI framework or Tailwind added
- [x] Separate MiniMax client modules created for text, native text, image, and video
- [x] Storage isolated in a small local persistence module
- [x] Telemetry math isolated in a dedicated helper module

## Endpoint And CORS Checks
All checks below were performed on `2026-04-02`.

- [x] `OPTIONS https://api.minimaxi.com/v1/chat/completions`
  Result: `200 OK`, browser CORS headers present for `http://localhost:3000`
- [x] `OPTIONS https://api.minimaxi.com/v1/image_generation`
  Result: `200 OK`, browser CORS headers present
- [x] `OPTIONS https://api.minimaxi.com/v1/video_generation`
  Result: `200 OK`, browser CORS headers present
- [x] `OPTIONS https://api.minimaxi.com/v1/query/video_generation?task_id=test`
  Result: `200 OK`, browser CORS headers present
- [x] `OPTIONS https://api.minimaxi.com/v1/files/retrieve_content?file_id=test`
  Result: `200 OK`, browser CORS headers present
- [x] `OPTIONS https://api.minimaxi.com/v1/text/chatcompletion_v2`
  Result: `200 OK`, browser CORS headers present
- [x] `GET https://api.minimaxi.com/v1/models`
  Result: `404`, so the app uses a static model catalog fallback
- [x] `GET https://api.minimax.io/v1/models`
  Result: `404`, same fallback conclusion
- [x] `POST https://api.minimaxi.com/v1/chat/completions` without auth
  Result: `401 Unauthorized`, confirming the endpoint is live and expects `Authorization`
- [x] `POST https://api.minimaxi.com/v1/text/chatcompletion_v2` without auth
  Result: body error with `status_code=1004`, confirming the legacy native text route is live

## Feature Checks
- [x] Text composer switches between `text`, `image`, and `video`
- [x] Text mode exposes stream toggle and model dropdown
- [x] Image mode exposes `T2I` and `I2I`
- [x] Video mode exposes `T2V` and `I2V`
- [x] Advanced drawer exposes playground-style parameters without crowding the main composer
- [x] Non-default parameters surface as compact summary chips
- [x] Text responses render Markdown
- [x] Reasoning details render in a collapsible `Thinking` block
- [x] Tool calls render as raw JSON without execution
- [x] Image results render inline with previews
- [x] Video results render inline with a playable `<video>` when a URL exists
- [x] Unsupported model/plan errors are surfaced from the endpoint response

## Telemetry Checks
- [x] Text telemetry includes `ttfb`, `ttft`, `generation`, `latency`, `tok/sec`, `prompt`, `completion`, `total`, `model`, `requestId`
- [x] Streaming text uses exact `tok/sec` based on first-token to complete timing
- [x] Non-stream text uses approximate `ttft` and `tok/sec`, marked with `~`
- [x] Image telemetry includes `model`, `n`, `aspect`, `seed`, `latency`, `success_count`, `failed_count`, `requestId`
- [x] Video telemetry includes `model`, `duration`, `resolution`, `queue`, `latency`, `status`, `file_id`, `requestId`

## Automated Verification
- [x] `npm test`
- [x] `npm run build`

## Automated Test Coverage
- [x] Storage default and versioned settings behavior
- [x] Catalog normalization and backend inference
- [x] SSE buffer parsing for streamed text
- [x] OpenAI-compatible payload building
- [x] Telemetry timing and tokens-per-second math
- [x] Video status normalization and request payload building

## Manual Checks Still Needed
These require a real MiniMax API key and live model access in the browser.

- [ ] Save API key, reload page, confirm key persistence and catalog fallback badge
- [ ] Streaming OpenAI-compatible text request with visible live token updates
- [ ] Non-stream text request with approximate telemetry markers
- [ ] Native `M2-her` request via `/text/chatcompletion_v2`
- [ ] Text-to-image request and reload persistence of generated image blobs
- [ ] Image-to-image request with local reference upload
- [ ] Text-to-video request from submission to polling to playback
- [ ] Image-to-video request using uploaded first frame
- [ ] Unsupported model or host combination to verify inline error rendering

## Runbook
- Install: `npm install`
- Start dev server: `npm run dev`
- Open: `http://127.0.0.1:4173`
- Run tests: `npm test`
- Build: `npm run build`

## Primary Files
- App shell: `src/App.tsx`
- UI components: `src/components/*`
- MiniMax clients: `src/lib/minimax/*`
- Storage: `src/lib/storage.ts`
- Telemetry: `src/lib/telemetry.ts`
- Styling: `src/styles.css`
