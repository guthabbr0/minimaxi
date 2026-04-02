import { describe, expect, it } from "vitest";
import {
  STATIC_CATALOG,
  inferTextBackend,
  normalizeCatalogPayload
} from "./catalog";

describe("catalog helpers", () => {
  it("infers the native backend only for M2-her", () => {
    expect(inferTextBackend("M2-her")).toBe("native");
    expect(inferTextBackend("MiniMax-M2.7")).toBe("openai");
  });

  it("normalizes a dynamic models payload", () => {
    const catalog = normalizeCatalogPayload({
      data: [
        { id: "MiniMax-M2.7" },
        { id: "M2-her" },
        { id: "image-01-live" },
        { id: "MiniMax-Hailuo-2.3-Fast" }
      ]
    });

    expect(catalog?.textOpenAi).toContain("MiniMax-M2.7");
    expect(catalog?.textNative).toContain("M2-her");
    expect(catalog?.imageI2I).toContain("image-01-live");
    expect(catalog?.videoI2V).toContain("MiniMax-Hailuo-2.3-Fast");
  });

  it("returns null when payload cannot be mapped to models", () => {
    expect(normalizeCatalogPayload({ hello: "world" })).toBeNull();
    expect(STATIC_CATALOG.textOpenAi[0]).toBe("MiniMax-M2.7");
  });
});
