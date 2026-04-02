import type { Telemetry, TokenUsage } from "../types";

export interface TelemetryTracker {
  requestStartedAt: number;
  headersAt?: number;
  firstTokenAt?: number;
  completedAt?: number;
}

export function createTelemetryTracker(): TelemetryTracker {
  return {
    requestStartedAt: Date.now()
  };
}

export function markHeaders(tracker: TelemetryTracker): TelemetryTracker {
  if (!tracker.headersAt) {
    tracker.headersAt = Date.now();
  }
  return tracker;
}

export function markFirstToken(tracker: TelemetryTracker): TelemetryTracker {
  if (!tracker.firstTokenAt) {
    tracker.firstTokenAt = Date.now();
  }
  return tracker;
}

export function markCompleted(tracker: TelemetryTracker): TelemetryTracker {
  tracker.completedAt = Date.now();
  return tracker;
}

export function finalizeTelemetry(params: {
  tracker: TelemetryTracker;
  usage?: TokenUsage;
  approximate?: boolean;
  requestId?: string;
  responseId?: string;
  model?: string;
}): Telemetry {
  const { tracker, usage, approximate, requestId, responseId, model } = params;
  const headersAt = tracker.headersAt ?? tracker.completedAt ?? tracker.requestStartedAt;
  const completedAt = tracker.completedAt ?? Date.now();
  const firstTokenAt = tracker.firstTokenAt;
  const promptTokens = usage?.prompt_tokens;
  const completionTokens = usage?.completion_tokens;
  const totalTokens = usage?.total_tokens;
  const ttfbMs = headersAt - tracker.requestStartedAt;
  const latencyMs = completedAt - tracker.requestStartedAt;
  const generationMs = firstTokenAt ? Math.max(0, completedAt - firstTokenAt) : undefined;

  let ttftMs: number | undefined;
  let tokensPerSecond: number | undefined;

  if (approximate) {
    ttftMs = latencyMs;
    if (completionTokens && latencyMs > 0) {
      tokensPerSecond = completionTokens / (latencyMs / 1000);
    }
  } else {
    ttftMs = firstTokenAt ? firstTokenAt - tracker.requestStartedAt : undefined;
    if (completionTokens && firstTokenAt && completedAt > firstTokenAt) {
      tokensPerSecond = completionTokens / ((completedAt - firstTokenAt) / 1000);
    }
  }

  return {
    requestStartedAt: tracker.requestStartedAt,
    headersAt: tracker.headersAt,
    firstTokenAt,
    completedAt,
    ttfbMs,
    ttftMs,
    generationMs,
    latencyMs,
    promptTokens,
    completionTokens,
    totalTokens,
    tokensPerSecond,
    approximate,
    requestId,
    responseId,
    model
  };
}

export function formatDuration(value?: number, approximate = false): string {
  if (value === undefined) {
    return "n/a";
  }
  const rounded = value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
  return approximate ? `~${rounded}` : rounded;
}

export function formatTokensPerSecond(
  value?: number,
  approximate = false
): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "n/a";
  }
  return `${approximate ? "~" : ""}${value.toFixed(1)}`;
}
