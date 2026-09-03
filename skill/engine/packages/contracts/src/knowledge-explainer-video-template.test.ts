import { describe, expect, it } from "vitest";
import { KnowledgeExplainerVideoTemplateSchema } from "./index";

describe("KnowledgeExplainerVideoTemplateSchema", () => {
  it("要求字幕槽明确声明物理尺寸、排版和拆卡策略", () => {
    const result = KnowledgeExplainerVideoTemplateSchema.safeParse({
      kind: "knowledge-explainer-template",
      id: "illustrated-caption",
      application: { id: "video-account", displayName: "视频号" },
      scenario: { id: "knowledge-insight", displayName: "知识观点短视频" },
      defaultViewId: "portrait-3x4",
      canvas: { width: 1080, height: 1440, fps: 24 },
      modules: [{
        id: "caption",
        kind: "caption",
        scope: "scene",
        rect: { x: 150, y: 316, width: 780, height: 196 },
        text: {
          fontFamily: "PingFang SC",
          fontSize: 74,
          fontWeight: 900,
          lineHeight: 1.16,
          letterSpacing: 0,
          textAlign: "center",
          whiteSpace: "pre"
        },
        fitting: {
          maxLines: 2,
          overflow: "split-scene",
          breakPriority: ["punctuation", "character"],
          metrics: { cjkAdvance: 1, latinAdvance: 0.58, punctuationAdvance: 0.3, whitespaceAdvance: 0.28 }
        }
      }]
    });

    expect(result.success).toBe(true);
  });

  it("拒绝没有明确拆卡策略的场景字幕槽", () => {
    const result = KnowledgeExplainerVideoTemplateSchema.safeParse({
      kind: "knowledge-explainer-template",
      id: "illustrated-caption",
      application: { id: "video-account", displayName: "视频号" },
      scenario: { id: "knowledge-insight", displayName: "知识观点短视频" },
      defaultViewId: "portrait-3x4",
      canvas: { width: 1080, height: 1440, fps: 24 },
      modules: [{
        id: "caption",
        kind: "caption",
        scope: "scene",
        rect: { x: 150, y: 316, width: 780, height: 196 },
        text: {
          fontFamily: "PingFang SC",
          fontSize: 74,
          fontWeight: 900,
          lineHeight: 1.16,
          letterSpacing: 0,
          textAlign: "center",
          whiteSpace: "pre"
        }
      }]
    });

    expect(result.success).toBe(false);
  });
});
