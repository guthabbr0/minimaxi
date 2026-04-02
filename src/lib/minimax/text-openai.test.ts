import { describe, expect, it } from "vitest";
import { buildOpenAiPayload, parseSseBuffer } from "./text-openai";
import type { TextConfig } from "../../types";

const baseConfig: TextConfig = {
  backend: "openai",
  model: "MiniMax-M2.7",
  systemPrompt: "",
  temperature: 0.7,
  topP: 0.95,
  maxTokens: 1024,
  reasoningSplit: true,
  toolsJson: "",
  toolChoice: "auto",
  extraBodyJson: ""
};

describe("parseSseBuffer", () => {
  it("splits completed events and preserves the trailing partial buffer", () => {
    const result = parseSseBuffer(
      'data: {"id":"a"}\n\ndata: {"id":"b"}\n\ndata: {"id":"partial"'
    );

    expect(result.events).toEqual(['{"id":"a"}', '{"id":"b"}']);
    expect(result.rest).toContain("partial");
  });
});

describe("buildOpenAiPayload", () => {
  it("adds stream usage reporting and merges extra body JSON", () => {
    const payload = buildOpenAiPayload(
      {
        ...baseConfig,
        toolsJson: '[{"type":"function","function":{"name":"lookup","parameters":{"type":"object"}}}]',
        extraBodyJson: '{"presence_penalty":0.3}'
      },
      [{ role: "user", content: "hello" }],
      true
    );

    expect(payload.stream).toBe(true);
    expect(payload.stream_options).toEqual({ include_usage: true });
    expect(payload.tools).toBeTruthy();
    expect(payload.presence_penalty).toBe(0.3);
  });
});
