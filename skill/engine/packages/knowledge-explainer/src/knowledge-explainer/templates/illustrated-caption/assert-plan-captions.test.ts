import { describe, expect, it } from "vitest";
import type { KnowledgeExplainerCreationPlan } from "@knowledge-explainer/contracts";
import { assertKnowledgeExplainerCreationPlanCaptionsFit } from "./assert-plan-captions";

const plan: KnowledgeExplainerCreationPlan = {
  kind: "knowledge-explainer-plan",
  id: "caption-fitting",
  creationMethodId: "knowledge-explainer",
  templateId: "illustrated-caption",
  episode: {
    accountId: "account",
    seriesId: "series",
    title: "字幕排版",
    language: "zh"
  },
  presentation: {
    background: { mode: "inherit-series" },
    backgroundMusic: { mode: "inherit-series" }
  },
  narration: {
    voice: { mode: "inherit-series" },
    script: { text: "固定字号两行呈现。" }
  },
  cards: [{
    id: "approved-caption",
    role: "claim",
    spokenText: "固定字号两行呈现。",
    caption: "固定字号\n两行呈现",
    illustrationAssetId: "compass-direction",
    illustrationCueId: "approved-caption"
  }]
};

describe("assertKnowledgeExplainerCreationPlanCaptionsFit", () => {
  it("保留通过 Skill 审核的固定字号两行字幕", () => {
    expect(() => assertKnowledgeExplainerCreationPlanCaptionsFit(plan, "illustrated-caption")).not.toThrow();
  });

  it("拒绝需要工程自动拆卡或缩字的制作单", () => {
    const overflowPlan: KnowledgeExplainerCreationPlan = {
      ...plan,
      cards: [{
        ...plan.cards[0]!,
        spokenText: `${"甲".repeat(11)}${"乙".repeat(11)}${"丙".repeat(11)}。`,
        caption: `${"甲".repeat(11)}\n${"乙".repeat(11)}\n${"丙".repeat(11)}`
      }]
    };

    expect(() => assertKnowledgeExplainerCreationPlanCaptionsFit(overflowPlan, "illustrated-caption"))
      .toThrow("exceeds the 2-line caption limit");
  });

  it("拒绝把一个中文字符单独作为口播卡，避免词语被错误切断", () => {
    const brokenWordPlan: KnowledgeExplainerCreationPlan = {
      ...plan,
      cards: [{
        ...plan.cards[0]!,
        spokenText: "断",
        caption: "断"
      }]
    };

    expect(() => assertKnowledgeExplainerCreationPlanCaptionsFit(brokenWordPlan, "illustrated-caption"))
      .toThrow("cannot contain a single CJK character");
  });

  it("拒绝按固定字数机械切片的长字幕", () => {
    const cards = Array.from({ length: 8 }, (_, index) => ({
      id: `mechanical-${String(index + 1)}`,
      role: "claim" as const,
      spokenText: `${"甲".repeat(16)}${index === 7 ? "。" : ""}`,
      caption: `${"甲".repeat(8)}\n${"甲".repeat(8)}`,
      illustrationAssetId: "compass-direction",
      illustrationCueId: `mechanical-${String(index + 1)}`
    }));
    const mechanicalPlan: KnowledgeExplainerCreationPlan = {
      ...plan,
      narration: { ...plan.narration, script: { text: cards.map((card) => card.spokenText).join("") } },
      cards
    };

    expect(() => assertKnowledgeExplainerCreationPlanCaptionsFit(mechanicalPlan, "illustrated-caption"))
      .toThrow("appears mechanically split by fixed character count");
  });
});
