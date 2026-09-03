import { describe, expect, it } from "vitest";
import type { NarrationTimingMap } from "@knowledge-explainer/contracts";
import { assertNarrationAssetsSynchronized } from "./assert-narration-assets";

const timingMap: NarrationTimingMap = {
  kind: "narration-timing-map",
  source: "local-forced-alignment",
  durationMs: 60000,
  segments: [{ id: "hook", startMs: 0, speechEndMs: 59750, endMs: 60000 }]
};

describe("assertNarrationAssetsSynchronized", () => {
  it("接受与实测 timing map 相差不超过 20ms 的音频", () => {
    expect(() => assertNarrationAssetsSynchronized({
      audioDurationMs: 60018,
      timingMap
    })).not.toThrow();
  });

  it("拒绝旧音频与新制作单 timing map 混用", () => {
    expect(() => assertNarrationAssetsSynchronized({
      audioDurationMs: 77000,
      timingMap
    })).toThrow("does not match measured timing map");
  });
});
