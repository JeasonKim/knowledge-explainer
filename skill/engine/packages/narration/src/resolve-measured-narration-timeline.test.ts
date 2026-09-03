import { describe, expect, it } from "vitest";
import type { NarrationTimingMap } from "@knowledge-explainer/contracts";
import { resolveMeasuredNarrationTimeline } from "./resolve-measured-narration-timeline";

const timingMap: NarrationTimingMap = {
  kind: "narration-timing-map",
  source: "local-forced-alignment",
  durationMs: 2500,
  segments: [
    { id: "opening", startMs: 0, speechEndMs: 800, endMs: 1100 },
    { id: "claim", startMs: 1100, speechEndMs: 2400, endMs: 2500 }
  ]
};

describe("resolveMeasuredNarrationTimeline", () => {
  it("用实测停顿延后字幕卡切换，并将结尾收束到视频最后一帧", () => {
    const result = resolveMeasuredNarrationTimeline(
      [{ id: "opening" }, { id: "claim" }],
      timingMap,
      24
    );

    expect(result.durationInFrames).toBe(60);
    expect(result.ranges).toEqual([
      { startFrame: 0, endFrame: 26 },
      { startFrame: 26, endFrame: 60 }
    ]);
  });

  it("拒绝字幕卡与实测音频片段不一致的映射", () => {
    expect(() => resolveMeasuredNarrationTimeline(
      [{ id: "different" }, { id: "claim" }],
      timingMap,
      24
    )).toThrow("does not match measured narration segment");
  });
});
