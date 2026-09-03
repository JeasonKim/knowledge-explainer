import { describe, expect, it } from "vitest";
import { findNarrationSpeechDensityIssues } from "./index";

describe("findNarrationSpeechDensityIssues", () => {
  it("拒绝实测字幕帧跨度无法承载对应口播文字的生产契约", () => {
    expect(findNarrationSpeechDensityIssues({
      timingSource: "measured",
      segments: [{
        id: "collapsed",
        text: "把期待藏成试探；",
        startMs: 0,
        speechEndMs: 208
      }]
    })).toEqual([{
      segmentIndex: 0,
      message: "narration segment collapsed has 7 spoken characters in 208ms; minimum is 280ms"
    }]);
  });

  it("不把预览时间轴当作实测口播执行密度门禁", () => {
    expect(findNarrationSpeechDensityIssues({
      timingSource: "preview",
      segments: [{
        id: "preview",
        text: "这只是排版预览",
        startMs: 0,
        speechEndMs: 42
      }]
    })).toEqual([]);
  });
});
