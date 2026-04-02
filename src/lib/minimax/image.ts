import { authHeaders, buildUrl, dataUrlToBlob, readJsonResponse } from "./base";
import type { ImageConfig, ImageGenerationResult } from "../../types";

interface ImageApiResponse {
  id?: string;
  data?: {
    image_urls?: string[];
    image_base64?: string[];
    images?: string[];
  };
  metadata?: {
    failed_count?: string;
    success_count?: string;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

export interface ImageRequest {
  baseUrl: string;
  apiKey: string;
  config: ImageConfig;
  prompt: string;
  subjectReferences: Array<{
    type: string;
    image_file: string;
  }>;
  signal?: AbortSignal;
}

export async function runImageGeneration(
  request: ImageRequest
): Promise<ImageGenerationResult> {
  const response = await fetch(buildUrl(request.baseUrl, "/image_generation"), {
    method: "POST",
    headers: authHeaders(request.apiKey),
    body: JSON.stringify(buildImagePayload(request.config, request.prompt, request.subjectReferences)),
    signal: request.signal
  });
  const body = await readJsonResponse<ImageApiResponse>(response);
  const generated = await normalizeImageOutputs(body.data);

  return {
    id: body.id,
    generated,
    metadata: body.metadata,
    raw: body,
    requestId:
      response.headers.get("minimax-request-id") ??
      response.headers.get("x-request-id") ??
      undefined
  };
}

export function buildImagePayload(
  config: ImageConfig,
  prompt: string,
  subjectReferences: Array<{ type: string; image_file: string }>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: config.model,
    prompt,
    aspect_ratio: config.aspectRatio,
    response_format: config.responseFormat,
    n: config.n,
    prompt_optimizer: config.promptOptimizer
  };

  if (subjectReferences.length) {
    payload.subject_reference = subjectReferences;
  }
  if (config.width !== "" && config.height !== "") {
    payload.width = config.width;
    payload.height = config.height;
  }
  if (config.seed !== "") {
    payload.seed = config.seed;
  }

  return payload;
}

async function normalizeImageOutputs(
  data: ImageApiResponse["data"]
): Promise<ImageGenerationResult["generated"]> {
  const generated: ImageGenerationResult["generated"] = [];

  for (const item of data?.image_base64 ?? []) {
    generated.push(base64ImageToPayload(item));
  }

  for (const item of data?.images ?? []) {
    if (item.startsWith("data:image/")) {
      generated.push(base64ImageToPayload(item));
    } else {
      generated.push({ mimeType: "image/png", remoteUrl: item });
    }
  }

  for (const item of data?.image_urls ?? []) {
    generated.push({ mimeType: "image/png", remoteUrl: item });
  }

  return generated;
}

function base64ImageToPayload(value: string): {
  mimeType: string;
  blob?: Blob;
} {
  if (value.startsWith("data:image/")) {
    const blob = dataUrlToBlob(value);
    return {
      mimeType: blob.type || "image/png",
      blob
    };
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return {
    mimeType: "image/png",
    blob: new Blob([bytes], { type: "image/png" })
  };
}
