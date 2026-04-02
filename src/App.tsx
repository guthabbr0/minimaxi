import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AdvancedDrawer } from "./components/AdvancedDrawer";
import { Composer } from "./components/Composer";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { Transcript } from "./components/Transcript";
import {
  createTelemetryTracker,
  finalizeTelemetry,
  markCompleted,
  markHeaders
} from "./lib/telemetry";
import {
  ApiError,
  createId,
  discoverModels,
  getImageDimensions,
  toApiErrorInfo,
  trimBaseUrl
} from "./lib/minimax/base";
import {
  DEFAULT_API_BASE_URL,
  API_BASE_PRESETS,
  STATIC_CATALOG,
  getDefaultImageModel,
  getDefaultVideoModel,
  getModelsForMode,
  inferTextBackend
} from "./lib/minimax/catalog";
import { runImageGeneration } from "./lib/minimax/image";
import { runNativeText } from "./lib/minimax/text-m2her";
import { runOpenAiText } from "./lib/minimax/text-openai";
import {
  retrieveVideoFile,
  runVideoGeneration
} from "./lib/minimax/video";
import {
  createDefaultThread,
  deleteThread as deleteThreadRecord,
  fileToStoredAsset,
  loadSettings,
  loadThreads,
  putAsset,
  readAssetAsDataUrl,
  saveSettings,
  saveThread
} from "./lib/storage";
import type {
  AppMode,
  AppSettings,
  CatalogState,
  ImageConfig,
  ImageReference,
  ImageReferenceType,
  NativeTextMessage,
  OpenAiTextMessage,
  TextRequestPayload,
  Theme,
  Thread,
  ThreadItem,
  ThreadItemStatus,
  VideoConfig
} from "./types";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export default function App() {
  const [settings, setSettings] = useState(loadSettings);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [catalogState, setCatalogState] = useState<CatalogState>({
    catalog: STATIC_CATALOG,
    isDiscovering: false,
    error: "Static catalog"
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const threadsRef = useRef<Thread[]>(threads);
  threadsRef.current = threads;

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadThreads();
      if (cancelled) {
        return;
      }
      if (!loaded.length) {
        const initialThread = createDefaultThread();
        setThreads([initialThread]);
        setActiveThreadId(initialThread.id);
      } else {
        setThreads(loaded);
        setActiveThreadId(loaded[0]?.id ?? null);
      }
      setIsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void Promise.all(threads.map((thread) => saveThread(thread)));
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [threads, isHydrated]);

  useEffect(() => {
    if (!settings.apiKey.trim()) {
      setCatalogState({
        catalog: STATIC_CATALOG,
        isDiscovering: false,
        error: "Static catalog"
      });
      return;
    }
    const controller = new AbortController();
    setCatalogState((current) => ({
      ...current,
      isDiscovering: true
    }));
    void discoverModels(settings.apiBaseUrl, settings.apiKey, controller.signal)
      .then(({ catalog, error }) => {
        setCatalogState({
          catalog,
          isDiscovering: false,
          error
        });
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") {
          return;
        }
        setCatalogState({
          catalog: STATIC_CATALOG,
          isDiscovering: false,
          error: error instanceof Error ? error.message : "Static catalog"
        });
      });
    return () => controller.abort();
  }, [settings.apiBaseUrl, settings.apiKey]);

  useEffect(() => {
    if (!isHydrated || !settings.apiKey.trim()) {
      return;
    }
    const staleItems = collectStaleVideoItems(threadsRef.current);
    if (!staleItems.length) {
      return;
    }
    const controller = new AbortController();
    void Promise.all(
      staleItems.map(async ({ itemId, fileId }) => {
        try {
          const file = await retrieveVideoFile(
            settings.apiBaseUrl,
            settings.apiKey,
            fileId,
            controller.signal
          );
          setThreads((current) =>
            current.map((thread) => ({
              ...thread,
              items: thread.items.map((item) =>
                item.id === itemId &&
                item.kind === "video" &&
                item.response &&
                "taskId" in item.response
                  ? {
                      ...item,
                      response: {
                        ...item.response,
                        fileId: file.fileId ?? item.response.fileId,
                        downloadUrl: file.downloadUrl,
                        expiresAt: file.expiresAt,
                        width: file.width,
                        height: file.height
                      }
                    }
                  : item
              )
            }))
          );
        } catch {
          return;
        }
      })
    );
    return () => controller.abort();
  }, [isHydrated, settings.apiBaseUrl, settings.apiKey]);

  const mode = settings.activeMode;
  const modelOptions = getModelsForMode(
    catalogState.catalog,
    mode,
    mode === "image"
      ? activeThread?.imageConfig.variant
      : mode === "video"
        ? activeThread?.videoConfig.variant
        : undefined
  );
  const summaryChips = activeThread ? buildSummaryChips(activeThread, mode) : [];

  function setThread(mutator: (thread: Thread) => Thread) {
    if (!activeThreadId) {
      return;
    }
    setThreads((current) =>
      current.map((thread) =>
        thread.id === activeThreadId ? withUpdatedAt(mutator(thread)) : thread
      )
    );
  }

  function replaceThread(threadId: string, mutator: (thread: Thread) => Thread) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? withUpdatedAt(mutator(thread)) : thread
      )
    );
  }

  function createThread() {
    const thread = createDefaultThread();
    setThreads((current) => [thread, ...current]);
    startTransition(() => setActiveThreadId(thread.id));
  }

  async function removeThread(threadId: string) {
    await deleteThreadRecord(threadId);
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    if (activeThreadId === threadId) {
      const fallback =
        threadsRef.current.find((thread) => thread.id !== threadId)?.id ?? null;
      startTransition(() => setActiveThreadId(fallback));
    }
  }

  function updatePrompt(targetMode: AppMode, value: string) {
    setThread((thread) => ({
      ...thread,
      drafts: {
        ...thread.drafts,
        textPrompt: targetMode === "text" ? value : thread.drafts.textPrompt,
        imagePrompt: targetMode === "image" ? value : thread.drafts.imagePrompt,
        videoPrompt: targetMode === "video" ? value : thread.drafts.videoPrompt
      }
    }));
  }

  function updateTextConfig<K extends keyof Thread["textConfig"]>(
    key: K,
    value: Thread["textConfig"][K]
  ) {
    setThread((thread) => ({
      ...thread,
      textConfig: {
        ...thread.textConfig,
        [key]: value
      }
    }));
  }

  function updateImageConfig<K extends keyof ImageConfig>(
    key: K,
    value: ImageConfig[K]
  ) {
    setThread((thread) => ({
      ...thread,
      imageConfig: {
        ...thread.imageConfig,
        [key]: value
      }
    }));
  }

  function updateVideoConfig<K extends keyof VideoConfig>(
    key: K,
    value: VideoConfig[K]
  ) {
    setThread((thread) => ({
      ...thread,
      videoConfig: {
        ...thread.videoConfig,
        [key]: value
      }
    }));
  }

  function handleModeChange(nextMode: AppMode) {
    setSettings((current) => ({
      ...current,
      activeMode: nextMode
    }));
  }

  function handleSettingsUpdate(patch: Partial<AppSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function handleThemeChange(theme: Theme) {
    setSettings((current) => ({ ...current, theme }));
  }

  function handleModelChange(model: string) {
    if (!activeThread) {
      return;
    }
    if (mode === "text") {
      const backend = inferTextBackend(model);
      updateTextConfig("model", model);
      updateTextConfig("backend", backend);
      return;
    }
    if (mode === "image") {
      updateImageConfig("model", model);
      return;
    }
    updateVideoConfig("model", model);
  }

  function setImageVariant(variant: "t2i" | "i2i") {
    setThread((thread) => {
      const models = getModelsForMode(catalogState.catalog, "image", variant);
      return {
        ...thread,
        imageConfig: {
          ...thread.imageConfig,
          variant,
          model: models.includes(thread.imageConfig.model)
            ? thread.imageConfig.model
            : getDefaultImageModel(variant)
        }
      };
    });
  }

  function setVideoVariant(variant: "t2v" | "i2v") {
    setThread((thread) => {
      const models = getModelsForMode(catalogState.catalog, "video", variant);
      return {
        ...thread,
        videoConfig: {
          ...thread.videoConfig,
          variant,
          model: models.includes(thread.videoConfig.model)
            ? thread.videoConfig.model
            : getDefaultVideoModel(variant)
        }
      };
    });
  }

  async function addImageReferences(files: FileList | null) {
    if (!files?.length || !activeThread) {
      return;
    }
    const references: ImageReference[] = [];
    for (const file of Array.from(files)) {
      validateImageFile(file);
      const asset = await fileToStoredAsset(file);
      references.push({
        ...asset,
        type: "subject"
      });
    }
    setThread((thread) => ({
      ...thread,
      imageConfig: {
        ...thread.imageConfig,
        subjectReferences: [...thread.imageConfig.subjectReferences, ...references]
      }
    }));
  }

  function removeImageReference(referenceId: string) {
    setThread((thread) => ({
      ...thread,
      imageConfig: {
        ...thread.imageConfig,
        subjectReferences: thread.imageConfig.subjectReferences.filter(
          (reference) => reference.id !== referenceId
        )
      }
    }));
  }

  async function addFirstFrame(files: FileList | null) {
    const file = files?.[0];
    if (!file) {
      return;
    }
    validateImageFile(file);
    const asset = await fileToStoredAsset(file);
    updateVideoConfig("firstFrameImage", asset);
  }

  function removeFirstFrame() {
    updateVideoConfig("firstFrameImage", null);
  }

  function updateImageReferenceType(referenceId: string, type: ImageReferenceType) {
    setThread((thread) => ({
      ...thread,
      imageConfig: {
        ...thread.imageConfig,
        subjectReferences: thread.imageConfig.subjectReferences.map((reference) =>
          reference.id === referenceId ? { ...reference, type } : reference
        )
      }
    }));
  }

  async function submit() {
    if (!activeThread) {
      return;
    }
    if (!settings.apiKey.trim()) {
      window.alert("Enter an API key first.");
      return;
    }
    if (busyItemId) {
      return;
    }

    try {
      if (mode === "text") {
        await submitText(activeThread);
      } else if (mode === "image") {
        await submitImage(activeThread);
      } else {
        await submitVideo(activeThread);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function submitText(thread: Thread) {
    const prompt = thread.drafts.textPrompt.trim();
    if (!prompt) {
      return;
    }

    const tracker = createTelemetryTracker();
    const request = {
      prompt,
      backend: thread.textConfig.backend,
      model: thread.textConfig.model,
      stream: settings.streamText,
      systemPrompt: thread.textConfig.systemPrompt,
      temperature: thread.textConfig.temperature,
      topP: thread.textConfig.topP,
      maxTokens: thread.textConfig.maxTokens,
      reasoningSplit: thread.textConfig.reasoningSplit,
      toolsJson: thread.textConfig.toolsJson,
      toolChoice: thread.textConfig.toolChoice,
      extraBodyJson: thread.textConfig.extraBodyJson
    } as const;

    const itemId = createId("item");
    const item: ThreadItem = {
      id: itemId,
      kind: "text",
      mode: "text",
      status: "running",
      request: { ...request },
      response: {
        content: "",
        reasoning: "",
        toolCalls: []
      },
      createdAt: Date.now()
    };

    replaceThread(thread.id, (current) => ({
      ...current,
      title: current.title === "New thread" ? shortenTitle(prompt) : current.title,
      drafts: {
        ...current.drafts,
        textPrompt: ""
      },
      items: [...current.items, item]
    }));
    setBusyItemId(itemId);

    try {
      const openAiMessages = buildOpenAiHistory(thread, prompt);
      const nativeMessages = buildNativeHistory(thread, prompt);
      const result =
        thread.textConfig.backend === "native"
          ? await runNativeText({
              baseUrl: settings.apiBaseUrl,
              apiKey: settings.apiKey,
              config: thread.textConfig,
              messages: nativeMessages,
              stream: settings.streamText,
              onResponse: () => markHeaders(tracker),
              onDelta: (snapshot) => {
                replaceThread(thread.id, (current) =>
                  updateStreamingTextItem(current, itemId, snapshot)
                );
              }
            })
          : await runOpenAiText({
              baseUrl: settings.apiBaseUrl,
              apiKey: settings.apiKey,
              config: thread.textConfig,
              messages: openAiMessages,
              stream: settings.streamText,
              onResponse: () => markHeaders(tracker),
              onDelta: (snapshot) => {
                replaceThread(thread.id, (current) =>
                  updateStreamingTextItem(current, itemId, snapshot)
                );
              }
            });

      tracker.firstTokenAt = result.firstTokenAt;
      markCompleted(tracker);
      const telemetry = finalizeTelemetry({
        tracker,
        usage: result.usage,
        approximate: !settings.streamText,
        requestId: result.requestId,
        responseId: result.responseId,
        model: thread.textConfig.model
      });

      replaceThread(thread.id, (current) =>
        finalizeItem(current, itemId, "success", {
          content: result.content,
          reasoning: result.reasoning,
          toolCalls: result.toolCalls,
          usage: result.usage,
          rawMessage: result.rawMessage,
          raw: result.raw,
          finishReason: result.finishReason
        }, undefined, telemetry)
      );
    } catch (error) {
      markCompleted(tracker);
      replaceThread(thread.id, (current) =>
        finalizeItem(
          current,
          itemId,
          "error",
          undefined,
          toApiErrorInfo(error),
          finalizeTelemetry({
            tracker,
            approximate: !settings.streamText,
            model: thread.textConfig.model
          })
        )
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function submitImage(thread: Thread) {
    const prompt = thread.drafts.imagePrompt.trim();
    if (!prompt) {
      return;
    }
    const tracker = createTelemetryTracker();
    const itemId = createId("item");
    const request = {
      prompt,
      variant: thread.imageConfig.variant,
      model: thread.imageConfig.model,
      aspectRatio: thread.imageConfig.aspectRatio,
      width: thread.imageConfig.width,
      height: thread.imageConfig.height,
      responseFormat: thread.imageConfig.responseFormat,
      seed: thread.imageConfig.seed,
      n: thread.imageConfig.n,
      promptOptimizer: thread.imageConfig.promptOptimizer,
      subjectReferences: thread.imageConfig.subjectReferences
    } as const;
    const item: ThreadItem = {
      id: itemId,
      kind: "image",
      mode: "image",
      status: "running",
      request: { ...request },
      response: {
        images: []
      },
      createdAt: Date.now()
    };
    replaceThread(thread.id, (current) => ({
      ...current,
      title: current.title === "New thread" ? shortenTitle(prompt) : current.title,
      drafts: {
        ...current.drafts,
        imagePrompt: ""
      },
      items: [...current.items, item]
    }));
    setBusyItemId(itemId);

    try {
      const subjectReferences = await Promise.all(
        thread.imageConfig.subjectReferences.map(async (reference) => {
          const imageFile = await readAssetAsDataUrl(reference.assetId);
          if (!imageFile) {
            return null;
          }
          return {
            type: reference.type,
            image_file: imageFile
          };
        })
      );
      const result = await runImageGeneration({
        baseUrl: settings.apiBaseUrl,
        apiKey: settings.apiKey,
        config: thread.imageConfig,
        prompt,
        subjectReferences: subjectReferences.filter(Boolean) as Array<{
          type: string;
          image_file: string;
        }>
      });
      markHeaders(tracker);
      const images = await Promise.all(
        result.generated.map(async (generated) => {
          if (generated.blob) {
            const assetId = await putAsset(generated.blob);
            const objectUrl = URL.createObjectURL(generated.blob);
            let width: number | undefined;
            let height: number | undefined;
            try {
              const dimensions = await getImageDimensions(objectUrl);
              width = dimensions.width;
              height = dimensions.height;
            } catch {
              width = undefined;
              height = undefined;
            }
            return {
              assetId,
              mimeType: generated.mimeType,
              objectUrl,
              width,
              height
            };
          }
          if (generated.remoteUrl) {
            return {
              mimeType: generated.mimeType,
              remoteUrl: generated.remoteUrl
            };
          }
          return {
            mimeType: generated.mimeType
          };
        })
      );

      markCompleted(tracker);
      replaceThread(thread.id, (current) =>
        finalizeItem(
          current,
          itemId,
          "success",
          {
            images,
            metadata: result.metadata,
            raw: result.raw
          },
          undefined,
          finalizeTelemetry({
            tracker,
            requestId: result.requestId,
            model: thread.imageConfig.model
          })
        )
      );
    } catch (error) {
      markCompleted(tracker);
      replaceThread(thread.id, (current) =>
        finalizeItem(
          current,
          itemId,
          "error",
          undefined,
          toApiErrorInfo(error),
          finalizeTelemetry({
            tracker,
            model: thread.imageConfig.model
          })
        )
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function submitVideo(thread: Thread) {
    const prompt = thread.drafts.videoPrompt.trim();
    if (!prompt) {
      return;
    }
    if (
      thread.videoConfig.variant === "i2v" &&
      !thread.videoConfig.firstFrameImage &&
      !thread.videoConfig.firstFrameUrl.trim()
    ) {
      throw new ApiError({
        message: "Image-to-video needs a first frame upload or URL."
      });
    }

    const tracker = createTelemetryTracker();
    const itemId = createId("item");
    const request = {
      prompt,
      variant: thread.videoConfig.variant,
      model: thread.videoConfig.model,
      duration: thread.videoConfig.duration,
      resolution: thread.videoConfig.resolution,
      promptOptimizer: thread.videoConfig.promptOptimizer,
      fastPretreatment: thread.videoConfig.fastPretreatment,
      firstFrameImage: thread.videoConfig.firstFrameImage,
      firstFrameUrl: thread.videoConfig.firstFrameUrl
    } as const;
    const item: ThreadItem = {
      id: itemId,
      kind: "video",
      mode: "video",
      status: "running",
      request: { ...request },
      response: {
        taskId: "",
        status: "queued"
      },
      createdAt: Date.now()
    };
    replaceThread(thread.id, (current) => ({
      ...current,
      title: current.title === "New thread" ? shortenTitle(prompt) : current.title,
      drafts: {
        ...current.drafts,
        videoPrompt: ""
      },
      items: [...current.items, item]
    }));
    setBusyItemId(itemId);

    try {
      const firstFrameDataUrl = thread.videoConfig.firstFrameImage
        ? await readAssetAsDataUrl(thread.videoConfig.firstFrameImage.assetId)
        : undefined;
      const result = await runVideoGeneration({
        baseUrl: settings.apiBaseUrl,
        apiKey: settings.apiKey,
        config: thread.videoConfig,
        prompt,
        firstFrameDataUrl,
        onResponse: () => markHeaders(tracker),
        onStatus: ({ taskId, status, fileId }) => {
          replaceThread(thread.id, (current) =>
            updateVideoProgressItem(current, itemId, taskId, status, fileId)
          );
        }
      });

      markCompleted(tracker);
      replaceThread(thread.id, (current) =>
        finalizeItem(
          current,
          itemId,
          result.status === "success" ? "success" : "error",
          {
            taskId: result.taskId,
            status: result.status,
            fileId: result.file?.fileId ?? result.fileId,
            downloadUrl: result.file?.downloadUrl,
            expiresAt: result.file?.expiresAt,
            width: result.file?.width,
            height: result.file?.height,
            durationSeconds: result.file?.durationSeconds,
            pollStartedAt: Date.now(),
            raw: result.raw
          },
          result.status === "failed"
            ? {
                message: "Video generation failed",
                raw: result.raw
              }
            : undefined,
          finalizeTelemetry({
            tracker,
            requestId: result.requestId,
            model: thread.videoConfig.model
          })
        )
      );
    } catch (error) {
      markCompleted(tracker);
      replaceThread(thread.id, (current) =>
        finalizeItem(
          current,
          itemId,
          "error",
          undefined,
          toApiErrorInfo(error),
          finalizeTelemetry({
            tracker,
            model: thread.videoConfig.model
          })
        )
      );
    } finally {
      setBusyItemId(null);
    }
  }

  async function refreshVideo(itemId: string) {
    if (!settings.apiKey.trim()) {
      return;
    }
    const thread = threadsRef.current.find((candidate) =>
      candidate.items.some((item) => item.id === itemId)
    );
    const item = thread?.items.find((candidate) => candidate.id === itemId);
    if (!thread || !item || item.kind !== "video" || !item.response || !("fileId" in item.response)) {
      return;
    }
    if (!item.response.fileId) {
      return;
    }
    const file = await retrieveVideoFile(
      settings.apiBaseUrl,
      settings.apiKey,
      item.response.fileId
    );
    replaceThread(thread.id, (current) => ({
      ...current,
      items: current.items.map((entry) =>
        entry.id === itemId &&
        entry.kind === "video" &&
        entry.response &&
        "taskId" in entry.response
          ? {
              ...entry,
              response: {
                ...entry.response,
                downloadUrl: file.downloadUrl,
                expiresAt: file.expiresAt,
                width: file.width,
                height: file.height
              }
            }
          : entry
      )
    }));
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "app-shell--sidebar-collapsed"}`}>
      <Sidebar
        activeThreadId={activeThreadId}
        threads={threads}
        onCreate={createThread}
        onDelete={(threadId) => {
          void removeThread(threadId);
        }}
        onSelect={(threadId) => startTransition(() => setActiveThreadId(threadId))}
      />

      <main className="main-pane">
        <header className="topbar">
          <button
            className="topbar__toggle"
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            ☰
          </button>
          <div className="topbar__title">
            <span>Thread</span>
            <strong>{activeThread?.title ?? "Loading..."}</strong>
          </div>
          <div className="topbar__controls">
            <span className="catalog-badge">
              {catalogState.isDiscovering
                ? "Checking models..."
                : catalogState.error ?? "Dynamic catalog"}
            </span>
            <button
              className="icon-btn"
              type="button"
              onClick={() => setSettingsOpen(true)}
              title="Settings"
            >
              ⚙
            </button>
          </div>
        </header>

        <Transcript
          showReasoning={settings.showReasoning}
          thread={activeThread}
          onRefreshVideo={(itemId) => {
            void refreshVideo(itemId);
          }}
        />

        {activeThread ? (
          <Composer
            catalogState={catalogState}
            isBusy={Boolean(busyItemId)}
            mode={mode}
            modelOptions={modelOptions}
            summaryChips={summaryChips}
            streamText={settings.streamText}
            thread={activeThread}
            onAddFirstFrame={(files) => {
              void addFirstFrame(files);
            }}
            onAddImageReferences={(files) => {
              void addImageReferences(files);
            }}
            onImageVariantChange={setImageVariant}
            onModeChange={handleModeChange}
            onModelChange={handleModelChange}
            onOpenAdvanced={() => setAdvancedOpen(true)}
            onPromptChange={updatePrompt}
            onRemoveFirstFrame={removeFirstFrame}
            onRemoveImageReference={removeImageReference}
            onSubmit={() => {
              void submit();
            }}
            onTextStreamChange={(value) =>
              setSettings((current) => ({
                ...current,
                streamText: value
              }))
            }
            onVideoFirstFrameUrlChange={(value) =>
              updateVideoConfig("firstFrameUrl", value)
            }
            onVideoVariantChange={setVideoVariant}
          />
        ) : null}
      </main>

      {activeThread ? (
        <AdvancedDrawer
          mode={mode}
          open={advancedOpen}
          thread={activeThread}
          onClose={() => setAdvancedOpen(false)}
          onUpdateImage={updateImageConfig}
          onUpdateImageReferenceType={updateImageReferenceType}
          onUpdateText={updateTextConfig}
          onUpdateVideo={updateVideoConfig}
        />
      ) : null}

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        catalogState={catalogState}
        onUpdate={handleSettingsUpdate}
        onClose={() => setSettingsOpen(false)}
      />

      <ThemeSwitcher
        activeTheme={settings.theme}
        onThemeChange={handleThemeChange}
      />
    </div>
  );
}

function withUpdatedAt(thread: Thread): Thread {
  return {
    ...thread,
    updatedAt: Date.now()
  };
}

function validateImageFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new ApiError({
      message: `${file.name} is not an image file.`
    });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError({
      message: `${file.name} is larger than 15MB.`
    });
  }
}

function shortenTitle(prompt: string): string {
  return prompt.length > 34 ? `${prompt.slice(0, 34)}…` : prompt;
}

function buildOpenAiHistory(thread: Thread, prompt: string) {
  const messages: OpenAiTextMessage[] = [];
  if (thread.textConfig.systemPrompt.trim()) {
    messages.push({
      role: "system",
      content: thread.textConfig.systemPrompt.trim()
    });
  }
  for (const item of thread.items) {
    if (
      item.kind !== "text" ||
      item.status !== "success" ||
      !item.response ||
      !("content" in item.response)
    ) {
      continue;
    }
    const request = item.request as TextRequestPayload;
    if (request.backend !== "openai") {
      continue;
    }
    messages.push({
      role: "user",
      content: request.prompt
    });
    messages.push(
      (item.response.rawMessage as OpenAiTextMessage | undefined) ?? {
        role: "assistant",
        content: item.response.content,
        tool_calls: item.response.toolCalls,
        reasoning_details: item.response.reasoning
          ? [{ type: "text", text: item.response.reasoning }]
          : []
      }
    );
  }
  messages.push({
    role: "user",
    content: prompt
  });
  return messages;
}

function buildNativeHistory(thread: Thread, prompt: string) {
  const messages: NativeTextMessage[] = [];
  if (thread.textConfig.systemPrompt.trim()) {
    messages.push({
      role: "system",
      name: "System",
      content: thread.textConfig.systemPrompt.trim()
    });
  }
  for (const item of thread.items) {
    if (
      item.kind !== "text" ||
      item.status !== "success" ||
      !item.response ||
      !("content" in item.response)
    ) {
      continue;
    }
    const request = item.request as TextRequestPayload;
    if (request.backend !== "native") {
      continue;
    }
    messages.push({
      role: "user",
      name: "User",
      content: request.prompt
    });
    messages.push({
      role: "assistant",
      name: "MiniMax AI",
      content: item.response.content
    });
  }
  messages.push({
    role: "user",
    name: "User",
    content: prompt
  });
  return messages;
}

function updateStreamingTextItem(
  thread: Thread,
  itemId: string,
  snapshot: {
    content: string;
    reasoning: string;
    toolCalls: unknown[];
  }
): Thread {
  return {
    ...thread,
    items: thread.items.map((item) =>
      item.id === itemId &&
      item.kind === "text" &&
      item.response &&
      "content" in item.response
        ? {
            ...item,
            response: {
              ...item.response,
              content: snapshot.content,
              reasoning: snapshot.reasoning,
              toolCalls: snapshot.toolCalls
            }
          }
        : item
    )
  };
}

function updateVideoProgressItem(
  thread: Thread,
  itemId: string,
  taskId: string,
  status: "queued" | "processing" | "success" | "failed",
  fileId?: string
): Thread {
  return {
    ...thread,
    items: thread.items.map((item) =>
      item.id === itemId &&
      item.kind === "video" &&
      item.response &&
      "taskId" in item.response
        ? {
            ...item,
            response: {
              ...item.response,
              taskId,
              status,
              fileId,
              pollStartedAt: item.response.pollStartedAt ?? Date.now()
            }
          }
        : item
    )
  };
}

function finalizeItem(
  thread: Thread,
  itemId: string,
  status: ThreadItemStatus,
  response?: ThreadItem["response"],
  error?: ThreadItem["error"],
  telemetry?: ThreadItem["telemetry"]
): Thread {
  return {
    ...thread,
    items: thread.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            status,
            response: response ?? item.response,
            error,
            telemetry
          }
        : item
    )
  };
}

function buildSummaryChips(thread: Thread, mode: AppMode): string[] {
  const defaults = createDefaultThread();
  if (mode === "text") {
    const chips: string[] = [];
    if (thread.textConfig.backend !== defaults.textConfig.backend) {
      chips.push(thread.textConfig.backend);
    }
    if (thread.textConfig.temperature !== defaults.textConfig.temperature) {
      chips.push(`temp ${thread.textConfig.temperature}`);
    }
    if (thread.textConfig.topP !== defaults.textConfig.topP) {
      chips.push(`top_p ${thread.textConfig.topP}`);
    }
    if (thread.textConfig.maxTokens !== defaults.textConfig.maxTokens) {
      chips.push(`max ${thread.textConfig.maxTokens}`);
    }
    if (thread.textConfig.systemPrompt.trim()) {
      chips.push("system prompt");
    }
    if (thread.textConfig.toolsJson.trim()) {
      chips.push("tools");
    }
    if (thread.textConfig.extraBodyJson.trim()) {
      chips.push("extra body");
    }
    return chips;
  }
  if (mode === "image") {
    const chips: string[] = [];
    if (thread.imageConfig.variant !== defaults.imageConfig.variant) {
      chips.push(thread.imageConfig.variant);
    }
    if (thread.imageConfig.aspectRatio !== defaults.imageConfig.aspectRatio) {
      chips.push(thread.imageConfig.aspectRatio);
    }
    if (thread.imageConfig.width !== "") {
      chips.push(`w ${thread.imageConfig.width}`);
    }
    if (thread.imageConfig.height !== "") {
      chips.push(`h ${thread.imageConfig.height}`);
    }
    if (thread.imageConfig.seed !== "") {
      chips.push(`seed ${thread.imageConfig.seed}`);
    }
    if (thread.imageConfig.n !== defaults.imageConfig.n) {
      chips.push(`n ${thread.imageConfig.n}`);
    }
    if (thread.imageConfig.promptOptimizer) {
      chips.push("optimizer");
    }
    if (thread.imageConfig.subjectReferences.length) {
      chips.push(`${thread.imageConfig.subjectReferences.length} refs`);
    }
    return chips;
  }

  const chips: string[] = [];
  if (thread.videoConfig.variant !== defaults.videoConfig.variant) {
    chips.push(thread.videoConfig.variant);
  }
  if (thread.videoConfig.duration !== defaults.videoConfig.duration) {
    chips.push(`${thread.videoConfig.duration}s`);
  }
  if (thread.videoConfig.resolution !== defaults.videoConfig.resolution) {
    chips.push(thread.videoConfig.resolution);
  }
  if (thread.videoConfig.promptOptimizer !== defaults.videoConfig.promptOptimizer) {
    chips.push("optimizer off");
  }
  if (thread.videoConfig.fastPretreatment) {
    chips.push("fast pre");
  }
  if (thread.videoConfig.firstFrameImage || thread.videoConfig.firstFrameUrl.trim()) {
    chips.push("first frame");
  }
  return chips;
}

function collectStaleVideoItems(
  threads: Thread[]
): Array<{ itemId: string; fileId: string }> {
  const stale: Array<{ itemId: string; fileId: string }> = [];
  const now = Date.now();
  for (const thread of threads) {
    for (const item of thread.items) {
      if (
        item.kind === "video" &&
        item.response &&
        "taskId" in item.response &&
        item.response.fileId &&
        (!item.response.downloadUrl ||
          (item.response.expiresAt ? item.response.expiresAt <= now : true))
      ) {
        stale.push({
          itemId: item.id,
          fileId: item.response.fileId
        });
      }
    }
  }
  return stale;
}
