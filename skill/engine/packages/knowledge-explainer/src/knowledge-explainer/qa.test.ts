import { describe, expect, it } from "vitest";
import type { KnowledgeExplainerProductionLock } from "@knowledge-explainer/contracts";
import {
  validateKnowledgeExplainerDisplayCaptionText,
  validateKnowledgeExplainerFramingContract,
  validateKnowledgeExplainerSceneCoverage
} from "./qa";

describe("validateKnowledgeExplainerProduction", () => {
  it("拒绝正文覆盖首尾主题帧", () => {
    const project = {
      durationInFrames: 102,
      framing: {
        introDurationInFrames: 12,
        outroDurationInFrames: 30
      },
      scenes: [{ id: "hook", startFrame: 0, endFrame: 72 }],
      illustrationCues: []
    } as unknown as KnowledgeExplainerProductionLock;

    expect(validateKnowledgeExplainerSceneCoverage(project)).toContain(
      "knowledge explainer scenes must begin after the 12-frame theme cover"
    );
  });

  it("拒绝超过半秒的主题封面生产文件", () => {
    const project = {
      format: { fps: 24 },
      framing: {
        introDurationInFrames: 36,
        outroDurationInFrames: 30
      }
    } as KnowledgeExplainerProductionLock;

    expect(validateKnowledgeExplainerFramingContract(project)).toContain(
      "knowledge explainer theme cover must be exactly 12 frames at 24 fps"
    );
  });

  it("拒绝包含标点符号的画面字幕", () => {
    expect(validateKnowledgeExplainerDisplayCaptionText("先理解，\n再判断。", "hook"))
      .toContain("knowledge explainer scene hook display caption cannot contain punctuation");
    expect(validateKnowledgeExplainerDisplayCaptionText("先理解\n再判断", "hook"))
      .toEqual([]);
  });
});
