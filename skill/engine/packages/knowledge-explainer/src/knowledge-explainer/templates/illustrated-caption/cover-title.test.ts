import { describe, expect, it } from "vitest";
import {
  resolveKnowledgeExplainerCoverTitle,
  resolveKnowledgeExplainerThemeTitleFontSize
} from "./cover-title";

describe("resolveKnowledgeExplainerCoverTitle", () => {
  it("优先沿用标题中的语义标点形成双层命题", () => {
    expect(resolveKnowledgeExplainerCoverTitle("家里最该被看见的，不是谁更辛苦")).toEqual({
      primaryTitle: "家里最该被看见的",
      emphasisTitle: "不是谁更辛苦"
    });
  });

  it("没有标点时优先在否定命题前分层", () => {
    expect(resolveKnowledgeExplainerCoverTitle("家庭不是一个人的责任")).toEqual({
      primaryTitle: "家庭",
      emphasisTitle: "不是一个人的责任"
    });
  });

  it("没有自然分隔点时保持原文并做视觉均衡切分", () => {
    const title = resolveKnowledgeExplainerCoverTitle("不要责怪当时那个不成熟的自己");

    expect(`${title.primaryTitle}${title.emphasisTitle}`).toBe("不要责怪当时那个不成熟的自己");
    expect(title.primaryTitle.length).toBeGreaterThanOrEqual(5);
    expect(title.emphasisTitle.length).toBeGreaterThanOrEqual(5);
  });
});

describe("resolveKnowledgeExplainerThemeTitleFontSize", () => {
  it("短命题使用参考方案的大字号，较长命题占满一行但不溢出", () => {
    expect(resolveKnowledgeExplainerThemeTitleFontSize("别人不懂你的痛")).toBe(100);
    expect(resolveKnowledgeExplainerThemeTitleFontSize("不代表你只能独自承受")).toBe(100);
    expect(resolveKnowledgeExplainerThemeTitleFontSize("妈妈的担心和孩子的边界")).toBe(94);
  });
});
