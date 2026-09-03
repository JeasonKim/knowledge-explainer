import { describe, expect, it } from "vitest";
import { KnowledgeExplainerCreationPlanSchema } from "./index";

const validPlan = {
  kind: "knowledge-explainer-plan",
  id: "semantic-caption-contract",
  creationMethodId: "knowledge-explainer",
  templateId: "illustrated-caption",
  episode: {
    accountId: "account",
    seriesId: "series",
    title: "语义字幕",
    language: "zh"
  },
  narration: {
    script: { text: "有些孩子长大以后，很少提起父亲。" }
  },
  cards: [{
    id: "hook",
    role: "hook",
    spokenText: "有些孩子长大以后，很少提起父亲。",
    caption: "有些孩子长大以后\n很少提起父亲",
    illustrationAssetId: "family",
    illustrationCueId: "hook"
  }]
};

describe("KnowledgeExplainerCreationPlanSchema", () => {
  it("只接受不带版本字段的当前制作单形态", () => {
    const result = KnowledgeExplainerCreationPlanSchema.safeParse(validPlan);

    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("version");
  });

  it("区分带自然标点的口播分段和无标点的语义字幕", () => {
    expect(KnowledgeExplainerCreationPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it("拒绝版本字段，并要求显式声明插画切换组", () => {
    expect(KnowledgeExplainerCreationPlanSchema.safeParse({ ...validPlan, version: 1 }).success).toBe(false);
    expect(KnowledgeExplainerCreationPlanSchema.safeParse({
      ...validPlan,
      cards: [{ ...validPlan.cards[0], illustrationCueId: undefined }]
    }).success).toBe(false);
  });

  it("拒绝在口播分段中混入展示换行", () => {
    const result = KnowledgeExplainerCreationPlanSchema.safeParse({
      ...validPlan,
      cards: [{
        ...validPlan.cards[0],
        spokenText: "有些孩子长大以后，\n很少提起父亲。"
      }]
    });

    expect(result.success).toBe(false);
  });

  it("拒绝字幕标点和声画文字不一致", () => {
    const punctuationResult = KnowledgeExplainerCreationPlanSchema.safeParse({
      ...validPlan,
      cards: [{ ...validPlan.cards[0], caption: "有些孩子长大以后，\n很少提起父亲。" }]
    });
    const rewrittenResult = KnowledgeExplainerCreationPlanSchema.safeParse({
      ...validPlan,
      cards: [{ ...validPlan.cards[0], caption: "有些孩子长大以后\n几乎不提起父亲" }]
    });

    expect(punctuationResult.success).toBe(false);
    expect(rewrittenResult.success).toBe(false);
  });
});
