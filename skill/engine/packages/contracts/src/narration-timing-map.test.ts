import { describe, expect, it } from "vitest";
import { NarrationTimingMapSchema } from "./index";

describe("NarrationTimingMapSchema", () => {
  it("接受连续的本地强制对齐时间轴", () => {
    const timingMap = NarrationTimingMapSchema.parse({
      kind: "narration-timing-map",
      source: "local-forced-alignment",
      durationMs: 2400,
      segments: [
        { id: "opening", startMs: 0, speechEndMs: 800, endMs: 1040 },
        { id: "claim", startMs: 1040, speechEndMs: 2200, endMs: 2400 }
      ]
    });

    expect(timingMap.segments[0]).toMatchObject({ id: "opening", endMs: 1040 });
  });

  it("接受由整条实测音频时长推导的暂定字幕时间轴", () => {
    const timingMap = NarrationTimingMapSchema.parse({
      kind: "narration-timing-map",
      source: "measured-total-duration",
      durationMs: 2400,
      segments: [
        { id: "opening", startMs: 0, speechEndMs: 1000, endMs: 1000 },
        { id: "claim", startMs: 1000, speechEndMs: 2400, endMs: 2400 }
      ]
    });

    expect(timingMap.source).toBe("measured-total-duration");
  });

  it("拒绝存在空洞或结尾时长不一致的时间轴", () => {
    const parsed = NarrationTimingMapSchema.safeParse({
      kind: "narration-timing-map",
      source: "local-forced-alignment",
      durationMs: 2400,
      segments: [
        { id: "opening", startMs: 0, speechEndMs: 800, endMs: 1040 },
        { id: "claim", startMs: 1100, speechEndMs: 2200, endMs: 2300 }
      ]
    });

    expect(parsed.success).toBe(false);
  });
});
