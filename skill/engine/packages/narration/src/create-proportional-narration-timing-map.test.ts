import { describe, expect, it } from "vitest";
import { createProportionalNarrationTimingMap } from "./create-proportional-narration-timing-map";

describe("createProportionalNarrationTimingMap", () => {
  it("以整条实测音频时长为边界，按口播文本权重分配视觉卡片时间", () => {
    const timingMap = createProportionalNarrationTimingMap({
      durationMs: 6000,
      beats: [
        { id: "opening", narrationText: "短句" },
        { id: "explanation", narrationText: "这是一个更长的解释句" },
        { id: "ending", narrationText: "收束" }
      ]
    });

    expect(timingMap).toMatchObject({
      source: "measured-total-duration",
      durationMs: 6000,
      segments: [
        { id: "opening", startMs: 0 },
        { id: "explanation" },
        { id: "ending", endMs: 6000, speechEndMs: 6000 }
      ]
    });
    expect(timingMap.segments[0]!.endMs).toBeLessThan(timingMap.segments[1]!.endMs);
    expect(timingMap.segments[1]!.endMs).toBeLessThan(timingMap.segments[2]!.endMs);
  });

  it("拒绝短于卡片数量的整条音频，避免生成零时长字幕卡", () => {
    expect(() => createProportionalNarrationTimingMap({
      durationMs: 2,
      beats: [
        { id: "one", narrationText: "一" },
        { id: "two", narrationText: "二" },
        { id: "three", narrationText: "三" }
      ]
    })).toThrow("at least the number of beats");
  });
});
