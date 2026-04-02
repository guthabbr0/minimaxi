import { describe, expect, it } from "vitest";
import { finalizeTelemetry } from "./telemetry";

describe("finalizeTelemetry", () => {
  it("calculates exact streaming telemetry", () => {
    const telemetry = finalizeTelemetry({
      tracker: {
        requestStartedAt: 1_000,
        headersAt: 1_120,
        firstTokenAt: 1_300,
        completedAt: 2_300
      },
      usage: {
        prompt_tokens: 30,
        completion_tokens: 100,
        total_tokens: 130
      },
      model: "MiniMax-M2.7"
    });

    expect(telemetry.ttfbMs).toBe(120);
    expect(telemetry.ttftMs).toBe(300);
    expect(telemetry.generationMs).toBe(1000);
    expect(telemetry.tokensPerSecond).toBe(100);
    expect(telemetry.totalTokens).toBe(130);
  });

  it("marks non-stream timings as approximate", () => {
    const telemetry = finalizeTelemetry({
      tracker: {
        requestStartedAt: 1_000,
        headersAt: 1_100,
        completedAt: 2_000
      },
      usage: {
        completion_tokens: 50
      },
      approximate: true
    });

    expect(telemetry.approximate).toBe(true);
    expect(telemetry.ttftMs).toBe(1000);
    expect(telemetry.tokensPerSecond).toBe(50);
  });
});
