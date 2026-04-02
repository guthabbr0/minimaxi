import { openDB, type DBSchema } from "idb";
import { DEFAULT_API_BASE_URL, getDefaultImageModel, getDefaultTextModel, getDefaultVideoModel } from "./minimax/catalog";
import { blobToDataUrl, createId } from "./minimax/base";
import type {
  AppSettings,
  ImageReference,
  Thread,
  UploadAsset
} from "../types";

const SETTINGS_KEY = "mmui:v1:settings";
const DB_NAME = "mmui:v1";

interface MiniMaxUiDb extends DBSchema {
  threads: {
    key: string;
    value: Thread;
  };
  assets: {
    key: string;
    value: Blob;
  };
}

let dbPromise: Promise<import("idb").IDBPDatabase<MiniMaxUiDb>> | null = null;

export const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  apiKey: "",
  activeMode: "text",
  streamText: true,
  rememberKey: true,
  showReasoning: true,
  theme: "midnight"
};

const VALID_THEMES = new Set<string>(["midnight", "ember", "abyss"]);

export function createDefaultThread(): Thread {
  const now = Date.now();
  return {
    id: createId("thread"),
    title: "New thread",
    createdAt: now,
    updatedAt: now,
    items: [],
    drafts: {
      textPrompt: "",
      imagePrompt: "",
      videoPrompt: ""
    },
    textConfig: {
      backend: "openai",
      model: getDefaultTextModel(),
      systemPrompt: "",
      temperature: 0.7,
      topP: 0.95,
      maxTokens: 1024,
      reasoningSplit: true,
      toolsJson: "",
      toolChoice: "auto",
      extraBodyJson: ""
    },
    imageConfig: {
      variant: "t2i",
      model: getDefaultImageModel("t2i"),
      prompt: "",
      aspectRatio: "1:1",
      width: "",
      height: "",
      responseFormat: "base64",
      seed: "",
      n: 1,
      promptOptimizer: false,
      subjectReferences: []
    },
    videoConfig: {
      variant: "t2v",
      model: getDefaultVideoModel("t2v"),
      prompt: "",
      duration: 6,
      resolution: "768P",
      promptOptimizer: true,
      fastPretreatment: false,
      firstFrameImage: null,
      firstFrameUrl: ""
    }
  };
}

export function loadSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const merged = {
      ...DEFAULT_SETTINGS,
      ...parsed
    };
    if (!VALID_THEMES.has(merged.theme)) {
      merged.theme = "midnight";
    }
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function saveThread(thread: Thread): Promise<void> {
  const db = await getDb();
  await db.put("threads", serializeThread(thread));
}

export async function loadThreads(): Promise<Thread[]> {
  const db = await getDb();
  const threads = await db.getAll("threads");
  const hydrated = await Promise.all(threads.map((thread) => hydrateThread(thread)));
  return hydrated.sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function deleteThread(threadId: string): Promise<void> {
  const db = await getDb();
  const thread = await db.get("threads", threadId);
  if (thread) {
    const assetIds = collectThreadAssetIds(thread);
    const tx = db.transaction(["threads", "assets"], "readwrite");
    await tx.objectStore("threads").delete(threadId);
    await Promise.all(assetIds.map((assetId) => tx.objectStore("assets").delete(assetId)));
    await tx.done;
    return;
  }
  await db.delete("threads", threadId);
}

export async function putAsset(blob: Blob): Promise<string> {
  const db = await getDb();
  const assetId = createId("asset");
  await db.put("assets", blob, assetId);
  return assetId;
}

export async function getAsset(assetId: string): Promise<Blob | undefined> {
  const db = await getDb();
  return db.get("assets", assetId);
}

export async function readAssetAsDataUrl(
  assetId: string
): Promise<string | undefined> {
  const blob = await getAsset(assetId);
  if (!blob) {
    return undefined;
  }
  return blobToDataUrl(blob);
}

export async function fileToStoredAsset(file: File): Promise<UploadAsset> {
  const assetId = await putAsset(file);
  return {
    id: createId("upload"),
    assetId,
    name: file.name,
    mimeType: file.type,
    previewUrl: URL.createObjectURL(file)
  };
}

export async function hydrateUploadAsset(
  asset: UploadAsset | null
): Promise<UploadAsset | null> {
  if (!asset) {
    return null;
  }
  const blob = await getAsset(asset.assetId);
  if (!blob) {
    return asset;
  }
  return {
    ...asset,
    previewUrl: URL.createObjectURL(blob)
  };
}

export async function hydrateImageReference(
  reference: ImageReference
): Promise<ImageReference> {
  const blob = await getAsset(reference.assetId);
  if (!blob) {
    return reference;
  }
  return {
    ...reference,
    previewUrl: URL.createObjectURL(blob)
  };
}

async function hydrateThread(thread: Thread): Promise<Thread> {
  const next = structuredClone(thread);

  next.imageConfig.subjectReferences = await Promise.all(
    next.imageConfig.subjectReferences.map((reference) =>
      hydrateImageReference(reference)
    )
  );
  next.videoConfig.firstFrameImage = await hydrateUploadAsset(
    next.videoConfig.firstFrameImage
  );

  next.items = await Promise.all(
    next.items.map(async (item) => {
      if (item.kind === "image" && item.response && "images" in item.response) {
        item.response.images = await Promise.all(
          item.response.images.map(async (image) => {
            if (!image.assetId) {
              return image;
            }
            const blob = await getAsset(image.assetId);
            return blob
              ? {
                  ...image,
                  objectUrl: URL.createObjectURL(blob)
                }
              : image;
          })
        );
      }

      if (
        item.kind === "video" &&
        item.request &&
        "firstFrameImage" in item.request
      ) {
        item.request.firstFrameImage = await hydrateUploadAsset(
          item.request.firstFrameImage
        );
      }

      if (
        item.kind === "image" &&
        item.request &&
        "subjectReferences" in item.request
      ) {
        item.request.subjectReferences = await Promise.all(
          item.request.subjectReferences.map((reference) =>
            hydrateImageReference(reference)
          )
        );
      }

      return item;
    })
  );

  return next;
}

function serializeThread(thread: Thread): Thread {
  const next = structuredClone(thread);

  next.imageConfig.subjectReferences = next.imageConfig.subjectReferences.map(
    stripPreviewUrl
  );
  next.videoConfig.firstFrameImage = stripOptionalPreviewUrl(
    next.videoConfig.firstFrameImage
  );

  next.items = next.items.map((item) => {
    const cloned = structuredClone(item);
    if (cloned.kind === "image" && cloned.response && "images" in cloned.response) {
      cloned.response.images = cloned.response.images.map((image) => ({
        ...image,
        objectUrl: undefined
      }));
    }
    if (
      cloned.kind === "video" &&
      cloned.request &&
      "firstFrameImage" in cloned.request
    ) {
      cloned.request.firstFrameImage = stripOptionalPreviewUrl(
        cloned.request.firstFrameImage
      );
    }
    if (
      cloned.kind === "image" &&
      cloned.request &&
      "subjectReferences" in cloned.request
    ) {
      cloned.request.subjectReferences = cloned.request.subjectReferences.map(
        stripPreviewUrl
      );
    }
    return cloned;
  });

  return next;
}

function stripPreviewUrl<T extends UploadAsset>(asset: T): T {
  return {
    ...asset,
    previewUrl: undefined
  };
}

function stripOptionalPreviewUrl<T extends UploadAsset | null>(
  asset: T
): T {
  if (!asset) {
    return asset;
  }
  return {
    ...asset,
    previewUrl: undefined
  } as T;
}

function collectThreadAssetIds(thread: Thread): string[] {
  const ids = new Set<string>();

  for (const reference of thread.imageConfig.subjectReferences) {
    ids.add(reference.assetId);
  }

  if (thread.videoConfig.firstFrameImage) {
    ids.add(thread.videoConfig.firstFrameImage.assetId);
  }

  for (const item of thread.items) {
    if (item.kind === "image" && "subjectReferences" in item.request) {
      for (const reference of item.request.subjectReferences) {
        ids.add(reference.assetId);
      }
    }

    if (item.kind === "video" && "firstFrameImage" in item.request) {
      if (item.request.firstFrameImage) {
        ids.add(item.request.firstFrameImage.assetId);
      }
    }

    if (item.kind === "image" && item.response && "images" in item.response) {
      for (const image of item.response.images) {
        if (image.assetId) {
          ids.add(image.assetId);
        }
      }
    }
  }

  return Array.from(ids);
}

function getDb() {
  dbPromise ??= openDB<MiniMaxUiDb>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("threads")) {
        db.createObjectStore("threads", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("assets")) {
        db.createObjectStore("assets");
      }
    }
  });
  return dbPromise;
}
