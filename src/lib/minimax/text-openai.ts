import { authHeaders, buildUrl, parseJsonInput, readErrorResponse } from "./base";
import type {
  OpenAiTextMessage,
  StreamSnapshot,
  TextConfig,
  TextGenerationResult
} from "../../types";

interface OpenAiChatCompletionResponse {
  id?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      role?: string;
      content?: string;
      tool_calls?: unknown[];
      reasoning_details?: Array<Record<string, unknown>>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenAiChunkResponse {
  id?: string;
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string;
      tool_calls?: unknown[];
      reasoning_details?: Array<Record<string, unknown>>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface OpenAiTextRequest {
  baseUrl: string;
  apiKey: string;
  config: TextConfig;
  messages: OpenAiTextMessage[];
  stream: boolean;
  signal?: AbortSignal;
  onResponse?: (response: Response) => void;
  onDelta?: (snapshot: StreamSnapshot) => void;
}

export async function runOpenAiText(
  request: OpenAiTextRequest
): Promise<TextGenerationResult> {
  const payload = buildOpenAiPayload(
    request.config,
    request.messages,
    request.stream
  );
  const response = await fetch(buildUrl(request.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: authHeaders(request.apiKey),
    body: JSON.stringify(payload),
    signal: request.signal
  });

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
    const body = (await response.json()) as OpenAiChatCompletionResponse;
    const choice = body.choices?.[0];
    const message = choice?.message;
    return {
      content: message?.content ?? "",
      reasoning: flattenReasoning(message?.reasoning_details),
      toolCalls: message?.tool_calls ?? [],
      usage: body.usage,
      rawMessage: {
        role: message?.role ?? "assistant",
        content: message?.content ?? "",
        tool_calls: message?.tool_calls ?? [],
        reasoning_details: message?.reasoning_details ?? []
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
  let responseId: string | undefined;
  let finishReason: string | null | undefined;
  let firstTokenAt: number | undefined;
  let content = "";
  let reasoning = "";
  let toolCalls: unknown[] = [];
  let usage: OpenAiChunkResponse["usage"];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseBuffer(buffer);
    buffer = parsed.rest;

    for (const event of parsed.events) {
      if (!event) {
        continue;
      }
      if (event === "[DONE]") {
        continue;
      }

      const chunk = JSON.parse(event) as OpenAiChunkResponse;
      responseId ??= chunk.id;
      usage = chunk.usage ?? usage;
      const choice = chunk.choices?.[0];
      finishReason = choice?.finish_reason ?? finishReason;
      const delta = choice?.delta;
      const nextContent = delta?.content ?? "";
      const nextReasoning = flattenReasoning(delta?.reasoning_details);
      const nextToolCalls = delta?.tool_calls ?? [];

      const previousContent = content;
      const previousReasoning = reasoning;
      const previousToolCalls = JSON.stringify(toolCalls);

      content = mergeProgressiveText(content, nextContent);
      reasoning = mergeProgressiveText(reasoning, nextReasoning);
      toolCalls = mergeToolCalls(toolCalls, nextToolCalls);

      if (
        !firstTokenAt &&
        (content !== previousContent ||
          reasoning !== previousReasoning ||
          JSON.stringify(toolCalls) !== previousToolCalls)
      ) {
        firstTokenAt = Date.now();
      }

      request.onDelta?.({
        content,
        reasoning,
        toolCalls,
        responseId
      });
    }
  }

  return {
    content,
    reasoning,
    toolCalls,
    usage,
    rawMessage: {
      role: "assistant",
      content,
      tool_calls: toolCalls,
      reasoning_details: reasoning ? [{ type: "text", text: reasoning }] : []
    },
    raw: {
      id: responseId,
      choices: [
        {
          finish_reason: finishReason,
          message: {
            role: "assistant",
            content,
            tool_calls: toolCalls,
            reasoning_details: reasoning ? [{ type: "text", text: reasoning }] : []
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

export function buildOpenAiPayload(
  config: TextConfig,
  messages: OpenAiTextMessage[],
  stream: boolean
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature,
    top_p: config.topP,
    stream,
    max_tokens: config.maxTokens
  };

  if (config.reasoningSplit) {
    payload.reasoning_split = true;
  }

  const tools = parseJsonInput(config.toolsJson, "tools");
  if (tools) {
    payload.tools = tools;
    if (config.toolChoice && config.toolChoice !== "auto") {
      payload.tool_choice = config.toolChoice;
    }
  }

  const extraBody = parseJsonInput(config.extraBodyJson, "extra body");
  if (extraBody && typeof extraBody === "object") {
    Object.assign(payload, extraBody);
  }

  if (stream) {
    payload.stream_options = { include_usage: true };
  }

  return payload;
}

export function parseSseBuffer(
  buffer: string
): { events: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const segments = normalized.split("\n\n");
  const rest = normalized.endsWith("\n\n") ? "" : segments.pop() ?? "";
  const events = segments
    .map((segment) =>
      segment
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n")
    )
    .filter(Boolean);
  return { events, rest };
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

function flattenReasoning(
  details?: Array<Record<string, unknown>>
): string {
  if (!details?.length) {
    return "";
  }
  return details
    .map((detail) => String(detail.text ?? ""))
    .filter(Boolean)
    .join("\n");
}

function mergeToolCalls(existing: unknown[], incoming: unknown[]): unknown[] {
  if (!incoming.length) {
    return existing;
  }

  const merged = [...existing] as Array<Record<string, unknown>>;
  for (const item of incoming) {
    if (!item || typeof item !== "object") {
      merged.push({ value: item });
      continue;
    }
    const call = item as Record<string, unknown>;
    const index =
      typeof call.index === "number" ? call.index : merged.length;
    const current = (merged[index] ?? {}) as Record<string, unknown>;
    const incomingFunction =
      call.function && typeof call.function === "object"
        ? (call.function as Record<string, unknown>)
        : undefined;
    const currentFunction =
      current.function && typeof current.function === "object"
        ? (current.function as Record<string, unknown>)
        : undefined;

    merged[index] = {
      ...current,
      ...call,
      function:
        incomingFunction || currentFunction
          ? {
              ...currentFunction,
              ...incomingFunction,
              arguments: mergeProgressiveText(
                String(currentFunction?.arguments ?? ""),
                String(incomingFunction?.arguments ?? "")
              )
            }
          : undefined
    };
  }
  return merged;
}
