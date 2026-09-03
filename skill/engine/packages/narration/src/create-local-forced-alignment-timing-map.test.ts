import { describe, expect, it } from "vitest";
import { createLocalForcedAlignmentTimingMap } from "./create-local-forced-alignment-timing-map";

describe("createLocalForcedAlignmentTimingMap", () => {
  it("使用已知脚本保留画面字幕，并把 ASR 的逐字时间与卡片停顿编译为连续时间轴", () => {
    const result = createLocalForcedAlignmentTimingMap({
      durationMs: 1500,
      minimumExactMatchRatio: 0.8,
      cards: [
        { id: "opening", narrationText: "人这一生" },
        { id: "claim", narrationText: "会改变" }
      ],
      tokens: [
        { text: "人", startMs: 0, endMs: 120 },
        { text: "這", startMs: 120, endMs: 220 },
        { text: "一", startMs: 220, endMs: 310 },
        { text: "生", startMs: 310, endMs: 500 },
        { text: "會", startMs: 700, endMs: 850 },
        { text: "改", startMs: 850, endMs: 1050 },
        { text: "變", startMs: 1050, endMs: 1280 }
      ]
    });

    expect(result.timingMap).toMatchObject({
      source: "local-forced-alignment",
      durationMs: 1500,
      segments: [
        { id: "opening", startMs: 0, speechEndMs: 500, endMs: 700 },
        { id: "claim", startMs: 700, speechEndMs: 1280, endMs: 1500 }
      ]
    });
    expect(result.quality).toMatchObject({
      sourceCharacterCount: 7,
      recognizedCharacterCount: 7,
      exactMatchCharacterCount: 7,
      interpolatedCharacterCount: 0,
      exactMatchRatio: 1
    });
  });

  it("在 ASR 漏字时插值，但在匹配质量不足时拒绝发布级时间轴", () => {
    const result = createLocalForcedAlignmentTimingMap({
      durationMs: 900,
      minimumExactMatchRatio: 0.5,
      cards: [
        { id: "opening", narrationText: "都剥开" },
        { id: "claim", narrationText: "再看" }
      ],
      tokens: [
        { text: "都", startMs: 0, endMs: 160 },
        { text: "再", startMs: 500, endMs: 650 },
        { text: "看", startMs: 650, endMs: 800 }
      ]
    });

    expect(result.quality).toMatchObject({
      exactMatchCharacterCount: 3,
      interpolatedCharacterCount: 2,
      exactMatchRatio: 0.6
    });
    expect(result.timingMap.segments).toEqual([
      { id: "opening", startMs: 0, speechEndMs: 387, endMs: 500 },
      { id: "claim", startMs: 500, speechEndMs: 800, endMs: 900 }
    ]);

    expect(() => createLocalForcedAlignmentTimingMap({
      durationMs: 900,
      minimumExactMatchRatio: 0.8,
      cards: [{ id: "opening", narrationText: "完全不同" }],
      tokens: [{ text: "错误", startMs: 0, endMs: 600 }]
    })).toThrow("exact match ratio");
  });

  it("仅裁剪 Whisper 末词的小幅时间戳越界，并将此事实写入质量结果", () => {
    const result = createLocalForcedAlignmentTimingMap({
      durationMs: 1000,
      minimumExactMatchRatio: 1,
      cards: [{ id: "ending", narrationText: "变化" }],
      tokens: [
        { text: "变", startMs: 400, endMs: 720 },
        { text: "化", startMs: 720, endMs: 1180 }
      ]
    });

    expect(result.timingMap.segments).toEqual([
      { id: "ending", startMs: 0, speechEndMs: 1000, endMs: 1000 }
    ]);
    expect(result.quality.clampedTerminalTokenCount).toBe(1);
  });

  it("裁剪 Whisper 末尾连续词的小幅整体越界，避免倒数第二词导致对齐失败", () => {
    const result = createLocalForcedAlignmentTimingMap({
      durationMs: 1000,
      minimumExactMatchRatio: 1,
      cards: [{ id: "ending", narrationText: "的关系" }],
      tokens: [
        { text: "的", startMs: 620, endMs: 850 },
        { text: "关", startMs: 850, endMs: 1080 },
        { text: "系", startMs: 1080, endMs: 1260 }
      ]
    });

    expect(result.timingMap.segments).toEqual([
      { id: "ending", startMs: 0, speechEndMs: 1000, endMs: 1000 }
    ]);
    expect(result.quality.clampedTerminalTokenCount).toBe(2);
  });

  it("将 Whisper 输出的连续阿拉伯数字与中文口播数字按同一数值对齐", () => {
    const result = createLocalForcedAlignmentTimingMap({
      durationMs: 2400,
      minimumExactMatchRatio: 1,
      cards: [{ id: "formula", narrationText: "二百八十五除以五等于五十七" }],
      tokens: [
        { text: "28", startMs: 0, endMs: 320 },
        { text: "5", startMs: 320, endMs: 460 },
        { text: "除", startMs: 460, endMs: 620 },
        { text: "以", startMs: 620, endMs: 780 },
        { text: "5", startMs: 780, endMs: 980 },
        { text: "等", startMs: 980, endMs: 1160 },
        { text: "于", startMs: 1160, endMs: 1320 },
        { text: "57", startMs: 1320, endMs: 1700 }
      ]
    });

    expect(result.quality.exactMatchRatio).toBe(1);
    expect(result.quality.interpolatedCharacterCount).toBe(0);
  });

  it("在相邻可靠锚点之间重建文字匹配但跨度异常的 ASR 时间戳", () => {
    const result = createLocalForcedAlignmentTimingMap({
      durationMs: 2000,
      minimumExactMatchRatio: 1,
      cards: [
        { id: "opening", narrationText: "一个怕显得物质，" },
        { id: "collapsed", narrationText: "把期待藏成试探；" },
        { id: "ending", narrationText: "后" }
      ],
      tokens: [
        { text: "一", startMs: 0, endMs: 210 },
        { text: "个", startMs: 210, endMs: 420 },
        { text: "怕", startMs: 420, endMs: 630 },
        { text: "显", startMs: 630, endMs: 840 },
        { text: "得", startMs: 840, endMs: 1050 },
        { text: "物", startMs: 1050, endMs: 1260 },
        { text: "质", startMs: 1260, endMs: 1500 },
        { text: "把", startMs: 1500, endMs: 1520 },
        { text: "期", startMs: 1520, endMs: 1540 },
        { text: "待", startMs: 1540, endMs: 1560 },
        { text: "藏", startMs: 1560, endMs: 1570 },
        { text: "成", startMs: 1570, endMs: 1590 },
        { text: "试", startMs: 1590, endMs: 1610 },
        { text: "探", startMs: 1610, endMs: 1610 },
        { text: "后", startMs: 1870, endMs: 2000 }
      ]
    });

    expect(result.timingMap.segments).toEqual([
      { id: "opening", startMs: 0, speechEndMs: 935, endMs: 935 },
      { id: "collapsed", startMs: 935, speechEndMs: 1870, endMs: 1870 },
      { id: "ending", startMs: 1870, speechEndMs: 2000, endMs: 2000 }
    ]);
    expect(result.quality).toMatchObject({
      rebalancedCharacterCount: 14,
      rebalancedSegmentIds: ["opening", "collapsed"]
    });
  });

  it("局部窗口总时长仍无法承载正文时拒绝伪造时间轴", () => {
    expect(() => createLocalForcedAlignmentTimingMap({
      durationMs: 200,
      minimumExactMatchRatio: 1,
      cards: [{ id: "collapsed", narrationText: "把期待藏成试探；" }],
      tokens: [
        { text: "把", startMs: 20, endMs: 40 },
        { text: "期", startMs: 40, endMs: 60 },
        { text: "待", startMs: 60, endMs: 80 },
        { text: "藏", startMs: 80, endMs: 100 },
        { text: "成", startMs: 100, endMs: 120 },
        { text: "试", startMs: 120, endMs: 140 },
        { text: "探", startMs: 140, endMs: 160 }
      ]
    })).toThrow(
      "narration segment collapsed has 7 spoken characters in 140ms; minimum is 280ms"
    );
  });
});
