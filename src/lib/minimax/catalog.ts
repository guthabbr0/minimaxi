import type {
  AppMode,
  CatalogSource,
  ImageVariant,
  ModelCatalog,
  TextBackend,
  VideoVariant
} from "../../types";

export const DEFAULT_API_BASE_URL = "https://api.minimaxi.com/v1";
export const API_BASE_PRESETS = [
  DEFAULT_API_BASE_URL,
  "https://api.minimax.io/v1",
  "custom"
] as const;

export const STATIC_CATALOG: ModelCatalog = {
  source: "static",
  textOpenAi: [
    "MiniMax-M2.7",
    "MiniMax-M2.7-highspeed",
    "MiniMax-M2.5",
    "MiniMax-M2.5-highspeed",
    "MiniMax-M2.1",
    "MiniMax-M2.1-highspeed",
    "MiniMax-M2"
  ],
  textNative: ["M2-her"],
  imageT2I: ["image-01"],
  imageI2I: ["image-01", "image-01-live"],
  videoT2V: [
    "MiniMax-Hailuo-2.3",
    "MiniMax-Hailuo-02",
    "T2V-01-Director",
    "T2V-01"
  ],
  videoI2V: [
    "MiniMax-Hailuo-2.3",
    "MiniMax-Hailuo-2.3-Fast",
    "MiniMax-Hailuo-02",
    "I2V-01-Director",
    "I2V-01-live",
    "I2V-01"
  ]
};

export const IMAGE_ASPECT_RATIOS = [
  "1:1",
  "16:9",
  "4:3",
  "3:2",
  "2:3",
  "3:4",
  "9:16",
  "21:9"
];

export const VIDEO_RESOLUTIONS = ["720P", "768P", "1080P", "512P"];
export const VIDEO_DURATIONS = [6, 10];

export function inferTextBackend(model: string): TextBackend {
  return STATIC_CATALOG.textNative.includes(model) ? "native" : "openai";
}

export function getModelsForMode(
  catalog: ModelCatalog,
  mode: AppMode,
  variant?: ImageVariant | VideoVariant
): string[] {
  if (mode === "text") {
    return [...catalog.textOpenAi, ...catalog.textNative];
  }
  if (mode === "image") {
    return variant === "i2i" ? catalog.imageI2I : catalog.imageT2I;
  }
  return variant === "i2v" ? catalog.videoI2V : catalog.videoT2V;
}

export function getDefaultTextModel(): string {
  return STATIC_CATALOG.textOpenAi[0];
}

export function getDefaultImageModel(variant: ImageVariant): string {
  return getModelsForMode(STATIC_CATALOG, "image", variant)[0] ?? "image-01";
}

export function getDefaultVideoModel(variant: VideoVariant): string {
  return (
    getModelsForMode(STATIC_CATALOG, "video", variant)[0] ??
    "MiniMax-Hailuo-2.3"
  );
}

export function normalizeCatalogPayload(
  payload: unknown,
  source: CatalogSource = "dynamic"
): ModelCatalog | null {
  const items = extractModelNames(payload);
  if (!items.length) {
    return null;
  }

  const deduped = Array.from(new Set(items));
  const textOpenAi = deduped.filter((item) => item.startsWith("MiniMax-M2"));
  const textNative = deduped.filter((item) => item === "M2-her");
  const image = deduped.filter((item) => item.startsWith("image-"));
  const video = deduped.filter(
    (item) =>
      item.startsWith("MiniMax-Hailuo") ||
      item.startsWith("T2V-") ||
      item.startsWith("I2V-")
  );

  if (!textOpenAi.length && !textNative.length && !image.length && !video.length) {
    return null;
  }

  return {
    source,
    textOpenAi: textOpenAi.length ? textOpenAi : STATIC_CATALOG.textOpenAi,
    textNative: textNative.length ? textNative : STATIC_CATALOG.textNative,
    imageT2I: image.length ? image.filter((item) => item === "image-01") : STATIC_CATALOG.imageT2I,
    imageI2I: image.length ? image : STATIC_CATALOG.imageI2I,
    videoT2V: video.length
      ? video.filter((item) => !item.startsWith("I2V-") && item !== "MiniMax-Hailuo-2.3-Fast")
      : STATIC_CATALOG.videoT2V,
    videoI2V: video.length ? video : STATIC_CATALOG.videoI2V
  };
}

function extractModelNames(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractModelNames(item));
  }

  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    if (typeof value.id === "string") {
      return [value.id];
    }
    if (typeof value.model === "string") {
      return [value.model];
    }
    const nestedKeys = ["data", "models", "items", "list"];
    for (const key of nestedKeys) {
      if (key in value) {
        return extractModelNames(value[key]);
      }
    }
  }

  return [];
}
