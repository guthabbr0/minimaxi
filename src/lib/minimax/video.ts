import {
  authHeaders,
  buildUrl,
  getImageDimensions,
  readJsonResponse,
  sleep
} from "./base";
import type { VideoConfig, VideoFileInfo, VideoTaskStatus } from "../../types";

interface VideoTaskCreateResponse {
  task_id: string;
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

interface VideoTaskQueryResponse {
  task_id?: string;
  status?: string;
  file_id?: string;
  file?: {
    file_id?: string;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

interface FileRetrieveResponse {
  file?: {
    file_id?: string | number;
    download_url?: string;
    filename?: string;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

export interface VideoRequest {
  baseUrl: string;
  apiKey: string;
  config: VideoConfig;
  prompt: string;
  firstFrameDataUrl?: string;
  signal?: AbortSignal;
  onResponse?: (response: Response) => void;
  onStatus?: (update: { taskId: string; status: VideoTaskStatus; fileId?: string }) => void;
}

export async function runVideoGeneration(
  request: VideoRequest
): Promise<{
  taskId: string;
  status: VideoTaskStatus;
  fileId?: string;
  file?: VideoFileInfo;
  raw?: unknown;
  requestId?: string;
}> {
  const createResponse = await fetch(buildUrl(request.baseUrl, "/video_generation"), {
    method: "POST",
    headers: authHeaders(request.apiKey),
    body: JSON.stringify(
      buildVideoPayload(request.config, request.prompt, request.firstFrameDataUrl)
    ),
    signal: request.signal
  });

  request.onResponse?.(createResponse);
  const createBody = await readJsonResponse<VideoTaskCreateResponse>(createResponse);
  const requestId =
    createResponse.headers.get("minimax-request-id") ??
    createResponse.headers.get("x-request-id") ??
    undefined;

  const taskId = createBody.task_id;
  let latest = await queryVideoTask(request.baseUrl, request.apiKey, taskId, request.signal);
  request.onStatus?.({
    taskId,
    status: latest.status,
    fileId: latest.fileId
  });

  while (!isTerminalVideoStatus(latest.status)) {
    await sleep(2500, request.signal);
    latest = await queryVideoTask(request.baseUrl, request.apiKey, taskId, request.signal);
    request.onStatus?.({
      taskId,
      status: latest.status,
      fileId: latest.fileId
    });
  }

  let file: VideoFileInfo | undefined;
  if (latest.status === "success" && latest.fileId) {
    file = await retrieveVideoFile(request.baseUrl, request.apiKey, latest.fileId, request.signal);
  }

  return {
    taskId,
    status: latest.status,
    fileId: latest.fileId,
    file,
    raw: {
      create: createBody,
      query: latest.raw,
      file: file?.raw
    },
    requestId
  };
}

export async function queryVideoTask(
  baseUrl: string,
  apiKey: string,
  taskId: string,
  signal?: AbortSignal
): Promise<{ status: VideoTaskStatus; fileId?: string; raw: unknown }> {
  const url = new URL(buildUrl(baseUrl, "/query/video_generation"));
  url.searchParams.set("task_id", taskId);
  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(apiKey, undefined, ""),
    signal
  });
  const body = await readJsonResponse<VideoTaskQueryResponse>(response);
  return {
    status: normalizeVideoStatus(body.status),
    fileId: body.file_id ?? body.file?.file_id,
    raw: body
  };
}

export async function retrieveVideoFile(
  baseUrl: string,
  apiKey: string,
  fileId: string,
  signal?: AbortSignal
): Promise<VideoFileInfo> {
  const url = new URL(buildUrl(baseUrl, "/files/retrieve"));
  url.searchParams.set("file_id", fileId);
  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(apiKey, undefined, ""),
    signal
  });
  const body = await readJsonResponse<FileRetrieveResponse>(response);
  const downloadUrl = body.file?.download_url;
  let width: number | undefined;
  let height: number | undefined;

  if (downloadUrl) {
    try {
      const dimensions = await getVideoDimensions(downloadUrl);
      width = dimensions.width;
      height = dimensions.height;
    } catch {
      width = undefined;
      height = undefined;
    }
  }

  return {
    fileId: String(body.file?.file_id ?? fileId),
    downloadUrl,
    expiresAt: downloadUrl ? Date.now() + 23 * 60 * 60 * 1000 : undefined,
    width,
    height,
    raw: body
  };
}

export function buildVideoPayload(
  config: VideoConfig,
  prompt: string,
  firstFrameDataUrl?: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: config.model,
    prompt,
    duration: config.duration,
    resolution: config.resolution,
    prompt_optimizer: config.promptOptimizer
  };

  if (config.fastPretreatment) {
    payload.fast_pretreatment = true;
  }

  const source = firstFrameDataUrl || config.firstFrameUrl.trim();
  if (config.variant === "i2v" && source) {
    payload.first_frame_image = source;
  }

  return payload;
}

export function normalizeVideoStatus(status?: string): VideoTaskStatus {
  const normalized = (status ?? "queued").toLowerCase();
  if (normalized === "success") {
    return "success";
  }
  if (normalized === "failed" || normalized === "fail") {
    return "failed";
  }
  if (normalized === "processing" || normalized === "running") {
    return "processing";
  }
  return "queued";
}

export function isTerminalVideoStatus(status: VideoTaskStatus): boolean {
  return status === "success" || status === "failed";
}

async function getVideoDimensions(
  url: string
): Promise<{ width: number; height: number }> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
    };
    video.onloadedmetadata = () => {
      cleanup();
      resolve();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Unable to read video metadata"));
    };
  });
  return {
    width: video.videoWidth,
    height: video.videoHeight
  };
}
