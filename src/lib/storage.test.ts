import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  createDefaultThread,
  loadSettings,
  saveSettings
} from "./storage";

describe("storage settings", () => {
  let storage: Storage;

  beforeEach(() => {
    const backing = new Map<string, string>();
    storage = {
      getItem: (key) => backing.get(key) ?? null,
      setItem: (key, value) => {
        backing.set(key, value);
      },
      removeItem: (key) => {
        backing.delete(key);
      },
      clear: () => {
        backing.clear();
      },
      key: (index) => Array.from(backing.keys())[index] ?? null,
      get length() {
        return backing.size;
      }
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: storage,
      configurable: true
    });
    storage.clear();
  });

  it("merges partial settings with defaults", () => {
    storage.setItem(
      "mmui:v1:settings",
      JSON.stringify({
        apiKey: "test-key",
        activeMode: "video"
      })
    );

    expect(loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      apiKey: "test-key",
      activeMode: "video"
    });
  });

  it("persists settings to localStorage", () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      apiKey: "abc",
      streamText: false
    });

    expect(loadSettings().apiKey).toBe("abc");
    expect(loadSettings().streamText).toBe(false);
  });

  it("coerces invalid or legacy theme values to the default", () => {
    storage.setItem(
      "mmui:v1:settings",
      JSON.stringify({ theme: "dark" })
    );
    expect(loadSettings().theme).toBe("midnight");

    storage.setItem(
      "mmui:v1:settings",
      JSON.stringify({ theme: "nonexistent" })
    );
    expect(loadSettings().theme).toBe("midnight");

    storage.setItem(
      "mmui:v1:settings",
      JSON.stringify({ theme: "" })
    );
    expect(loadSettings().theme).toBe("midnight");
  });
});

describe("default thread", () => {
  it("creates a clean disposable thread scaffold", () => {
    const thread = createDefaultThread();

    expect(thread.title).toBe("New thread");
    expect(thread.textConfig.model).toBe("MiniMax-M2.7");
    expect(thread.imageConfig.model).toBe("image-01");
    expect(thread.videoConfig.model).toBe("MiniMax-Hailuo-2.3");
  });
});
