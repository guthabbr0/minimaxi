import { normalizeCatalogPayload, STATIC_CATALOG } from "./catalog";
import type { ApiErrorInfo, ModelCatalog } from "../../types";

export class ApiError extends Error {
  status?: number;
  code?: string | number;
  raw?: unknown;

  constructor(info: ApiErrorInfo) {
    super(info.message);
    this.name = "ApiError";
    this.status = info.status;
    this.code = info.code;
    this.raw = info.raw;
  }
}

export function createId(prefix = "mm"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function trimBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function buildUrl(baseUrl: string, path: string): string {
  return `${trimBaseUrl(baseUrl)}${path}`;
}

export function authHeaders(
  apiKey: string,
  extra?: HeadersInit,
  contentType = "application/json"
): Headers {
  const headers = new Headers(extra);
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Authorization", `Bearer ${apiKey}`);
  return headers;
}

export async function readErrorResponse(response: Response): Promise<ApiError> {
  const rawText = await response.text();
  let raw: unknown = rawText;
  try {
    raw = rawText ? JSON.parse(rawText) : undefined;
  } catch {
    raw = rawText;
  }

  const rawObject =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : undefined;
  const errorObject =
    rawObject?.error && typeof rawObject.error === "object"
      ? (rawObject.error as Record<string, unknown>)
      : undefined;
  const baseResp =
    rawObject?.base_resp && typeof rawObject.base_resp === "object"
      ? (rawObject.base_resp as Record<string, unknown>)
      : undefined;

  return new ApiError({
    status: response.status,
    code:
      (typeof errorObject?.type === "string" && errorObject.type) ||
      (typeof errorObject?.code === "string" && errorObject.code) ||
      (typeof baseResp?.status_code === "number" && baseResp.status_code) ||
      undefined,
    message:
      (typeof errorObject?.message === "string" && errorObject.message) ||
      (typeof baseResp?.status_msg === "string" && baseResp.status_msg) ||
      `${response.status} ${response.statusText}`.trim(),
    raw
  });
}

export function toApiErrorInfo(error: unknown): ApiErrorInfo {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      raw: error.raw
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "Unknown error", raw: error };
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await readErrorResponse(response);
  }
  return (await response.json()) as T;
}

export async function minimaxJsonRequest<T>(
  url: string,
  init: RequestInit
): Promise<{ data: T; response: Response }> {
  const response = await fetch(url, init);
  const data = await readJsonResponse<T>(response);
  return { data, response };
}

export async function discoverModels(
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<{ catalog: ModelCatalog; error?: string }> {
  try {
    const response = await fetch(buildUrl(baseUrl, "/models"), {
      method: "GET",
      headers: authHeaders(apiKey, undefined, ""),
      signal
    });

    if (response.status === 404) {
      return { catalog: STATIC_CATALOG, error: "Static catalog" };
    }

    if (!response.ok) {
      throw await readErrorResponse(response);
    }

    const payload = (await response.json()) as unknown;
    const catalog = normalizeCatalogPayload(payload);
    if (!catalog) {
      return { catalog: STATIC_CATALOG, error: "Static catalog" };
    }

    return { catalog };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw error;
    }
    return {
      catalog: STATIC_CATALOG,
      error:
        error instanceof Error && error.message
          ? `Static catalog: ${error.message}`
          : "Static catalog"
    };
  }
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, payload] = dataUrl.split(",", 2);
  const mimeMatch = /data:([^;]+);base64/.exec(meta);
  const mimeType = mimeMatch?.[1] ?? "application/octet-stream";
  const binary = atob(payload ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function getImageDimensions(
  source: string
): Promise<{ width: number; height: number }> {
  const image = new Image();
  image.src = source;
  await image.decode();
  return {
    width: image.naturalWidth,
    height: image.naturalHeight
  };
}

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms);
    if (!signal) {
      return;
    }
    const abort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function ensureJsonString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function parseJsonInput(value: string, label: string): unknown | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    throw new ApiError({
      message: `Invalid ${label} JSON: ${(error as Error).message}`,
      raw: value
    });
  }
}
