import { describe, expect, it } from "vitest";
import {
  presentIllustratedCaptionDebuggingState,
  presentKnowledgeExplainerFooterColumns
} from "./debugging-presentation";

describe("插画字幕调试状态", () => {
  it("主题封面和收束页复用正式标题分层，并区分回看眉题", () => {
    const request = {
      canvas: { width: 1080, height: 1440, fps: 24 },
      episodeTitle: "为什么越忙，越容易焦虑？",
      seriesDisplayName: "理解机制课"
    };

    expect(presentIllustratedCaptionDebuggingState({ ...request, state: "theme-cover" }))
      .toEqual(expect.objectContaining({
        frameKind: "theme-card",
        eyebrow: "理解机制课",
        primaryTitle: "为什么越忙",
        emphasisTitle: "越容易焦虑？"
      }));
    expect(presentIllustratedCaptionDebuggingState({ ...request, state: "theme-closing" }).eyebrow)
      .toBe("本期回看 · 理解机制课");
    expect(presentIllustratedCaptionDebuggingState({ ...request, state: "content" }))
      .toEqual({ state: "content", frameKind: "content" });
  });

  it("把富文本样例还原成正式的三栏两行页脚", () => {
    expect(presentKnowledgeExplainerFooterColumns(
      "先理解\n再判断｜保留善意\n也有边界｜向内反思\n向外行动"
    )).toEqual([
      { topLine: "先理解", bottomLine: "再判断" },
      { topLine: "保留善意", bottomLine: "也有边界" },
      { topLine: "向内反思", bottomLine: "向外行动" }
    ]);
    expect(() => presentKnowledgeExplainerFooterColumns("只有一栏"))
      .toThrow("三栏两行");
  });
});
