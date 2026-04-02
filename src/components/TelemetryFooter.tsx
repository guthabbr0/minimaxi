import { formatDuration, formatTokensPerSecond } from "../lib/telemetry";
import type { ThreadItem } from "../types";

interface TelemetryFooterProps {
  item: ThreadItem;
}

export function TelemetryFooter({ item }: TelemetryFooterProps) {
  const parts: string[] = [];
  const telemetry = item.telemetry;

  if (telemetry?.model) {
    parts.push(`model ${telemetry.model}`);
  }

  if (item.kind === "text") {
    parts.push(`ttfb ${formatDuration(telemetry?.ttfbMs, telemetry?.approximate)}`);
    parts.push(`ttft ${formatDuration(telemetry?.ttftMs, telemetry?.approximate)}`);
    parts.push(
      `gen ${formatDuration(telemetry?.generationMs, telemetry?.approximate)}`
    );
    parts.push(
      `lat ${formatDuration(telemetry?.latencyMs, telemetry?.approximate)}`
    );
    parts.push(
      `tok/sec ${formatTokensPerSecond(
        telemetry?.tokensPerSecond,
        telemetry?.approximate
      )}`
    );
    parts.push(`prompt ${telemetry?.promptTokens ?? "n/a"}`);
    parts.push(`completion ${telemetry?.completionTokens ?? "n/a"}`);
    parts.push(`total ${telemetry?.totalTokens ?? "n/a"}`);
  }

  if (item.kind === "image" && item.response && "metadata" in item.response) {
    const request = item.request;
    if ("n" in request) {
      parts.push(`n ${request.n}`);
      parts.push(`aspect ${request.aspectRatio}`);
      parts.push(`seed ${request.seed === "" ? "auto" : request.seed}`);
    }
    parts.push(`lat ${formatDuration(telemetry?.latencyMs)}`);
    parts.push(`ok ${item.response.metadata?.success_count ?? "?"}`);
    parts.push(`fail ${item.response.metadata?.failed_count ?? "?"}`);
  }

  if (item.kind === "video" && item.response && "taskId" in item.response) {
    const request = item.request;
    if ("duration" in request) {
      parts.push(`dur ${request.duration}s`);
      parts.push(`res ${request.resolution}`);
    }
    const queueTime =
      item.response.pollStartedAt && telemetry?.completedAt
        ? telemetry.completedAt - item.response.pollStartedAt
        : undefined;
    parts.push(`queue ${formatDuration(queueTime)}`);
    parts.push(`lat ${formatDuration(telemetry?.latencyMs)}`);
    parts.push(`status ${item.response.status}`);
    if (item.response.width && item.response.height) {
      parts.push(`${item.response.width}x${item.response.height}`);
    }
    parts.push(`file ${item.response.fileId ?? "n/a"}`);
  }

  if (telemetry?.requestId) {
    parts.push(`req ${telemetry.requestId}`);
  }

  return <div className="telemetry-footer">{parts.join(" • ")}</div>;
}
