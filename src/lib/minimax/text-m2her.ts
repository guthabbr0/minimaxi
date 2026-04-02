import { authHeaders, buildUrl, readErrorResponse } from "./base";
import { parseSseBuffer } from "./text-openai";
import type {
  NativeTextMessage,
  StreamSnapshot,
  TextConfig,
  TextGenerationResult
} from "../../types";

interface NativeTextResponse {
  id?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      role?: string;
      content?: string;
      name?: string;
      audio_content?: string;
    };
    delta?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    total_characters?: number;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

export interface NativeTextRequest {
  baseUrl: string;
  apiKey: string;
  config: TextConfig;
  messages: NativeTextMessage[];
  stream: boolean;
  signal?: AbortSignal;
  onResponse?: (response: Response) => void;
  onDelta?: (snapshot: StreamSnapshot) => void;
}

export async function runNativeText(
  request: NativeTextRequest
): Promise<TextGenerationResult> {
  const payload = buildNativePayload(request.config, request.messages, request.stream);
  const response = await fetch(
    buildUrl(request.baseUrl, "/text/chatcompletion_v2"),
    {
      method: "POST",
      headers: authHeaders(request.apiKey),
      body: JSON.stringify(payload),
      signal: request.signal
    }
  );

  request.onResponse?.(response);

  if (!response.ok) {
    throw await readErrorResponse(response);
  }

  const requestId =
    response.headers.get("minimax-request-id") ??
    response.headers.get("x-request-id") ??
    undefined;
  const contentType = response.headers.get("content-type") ?? "";

  if (!request.stream || !contentType.includes("text/event-stream") || !response.body) {
    const body = (await response.json()) as NativeTextResponse;
    const choice = body.choices?.[0];
    return {
      content: choice?.message?.content ?? "",
      reasoning: "",
      toolCalls: [],
      usage: body.usage,
      rawMessage: {
        role: choice?.message?.role ?? "assistant",
        content: choice?.message?.content ?? "",
        name: choice?.message?.name ?? "MiniMax AI"
      },
      raw: body,
      finishReason: choice?.finish_reason,
      responseId: body.id,
      requestId
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let usage: NativeTextResponse["usage"];
  let responseId: string | undefined;
  let finishReason: string | null | undefined;
  let firstTokenAt: number | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.rest;

    for (const event of parsed.events) {
      if (!event || event === "[DONE]") {
        continue;
      }
      const chunk = JSON.parse(event) as NativeTextResponse;
      responseId ??= chunk.id;
      usage = chunk.usage ?? usage;
      const choice = chunk.choices?.[0];
      finishReason = choice?.finish_reason ?? finishReason;
      const nextContent =
        choice?.delta?.content ?? choice?.message?.content ?? "";

      const nextMerged = mergeProgressiveText(content, nextContent);
      if (!firstTokenAt && nextMerged !== content) {
        firstTokenAt = Date.now();
      }
      content = nextMerged;

      request.onDelta?.({
        content,
        reasoning: "",
        toolCalls: [],
        responseId
      });
    }
  }

  return {
    content,
    reasoning: "",
    toolCalls: [],
    usage,
    rawMessage: {
      role: "assistant",
      name: "MiniMax AI",
      content
    },
    raw: {
      id: responseId,
      choices: [
        {
          finish_reason: finishReason,
          message: {
            role: "assistant",
            name: "MiniMax AI",
            content
          }
        }
      ],
      usage
    },
    finishReason,
    responseId,
    requestId,
    firstTokenAt
  };
}

export function buildNativePayload(
  config: TextConfig,
  messages: NativeTextMessage[],
  stream: boolean
): Record<string, unknown> {
  return {
    model: config.model,
    messages,
    stream,
    max_completion_tokens: config.maxTokens,
    temperature: config.temperature,
    top_p: config.topP
  };
}

function mergeProgressiveText(current: string, next: string): string {
  if (!next) {
    return current;
  }
  if (!current) {
    return next;
  }
  if (next.startsWith(current)) {
    return next;
  }
  if (current.endsWith(next)) {
    return current;
  }
  return `${current}${next}`;
}
