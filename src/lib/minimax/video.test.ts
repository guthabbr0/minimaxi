import { describe, expect, it } from "vitest";
import {
  buildVideoPayload,
  isTerminalVideoStatus,
  normalizeVideoStatus
} from "./video";
import type { VideoConfig } from "../../types";

const baseConfig: VideoConfig = {
  variant: "t2v",
  model: "MiniMax-Hailuo-2.3",
  prompt: "",
  duration: 6,
  resolution: "768P",
  promptOptimizer: true,
  fastPretreatment: false,
  firstFrameImage: null,
  firstFrameUrl: ""
};

describe("video helpers", () => {
  it("normalizes status values from polling responses", () => {
    expect(normalizeVideoStatus("Success")).toBe("success");
    expect(normalizeVideoStatus("Fail")).toBe("failed");
    expect(normalizeVideoStatus("Processing")).toBe("processing");
    expect(normalizeVideoStatus(undefined)).toBe("queued");
    expect(isTerminalVideoStatus("success")).toBe(true);
    expect(isTerminalVideoStatus("processing")).toBe(false);
  });

  it("includes a first frame only for image-to-video requests", () => {
    expect(
      buildVideoPayload(
        { ...baseConfig, variant: "i2v", firstFrameUrl: "https://example.com/frame.png" },
        "animate this",
        undefined
      )
    ).toMatchObject({
      first_frame_image: "https://example.com/frame.png"
    });

    expect(buildVideoPayload(baseConfig, "animate this")).not.toHaveProperty(
      "first_frame_image"
    );
  });
});
