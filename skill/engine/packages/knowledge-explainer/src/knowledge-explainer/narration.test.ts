import { describe, expect, it } from "vitest";
import {
  KnowledgeExplainerCreationPlanSchema,
  type KnowledgeExplainerCreationPlan
} from "@knowledge-explainer/contracts";
import { createKnowledgeExplainerNarrationScript } from "./narration";

const plan: KnowledgeExplainerCreationPlan = {
  kind: "knowledge-explainer-plan",
  id: "impermanence-first-minute",
  creationMethodId: "knowledge-explainer",
  templateId: "illustrated-caption",
  episode: {
    accountId: "life-account",
    seriesId: "impermanence",
    title: "怎么和无常共处",
    language: "zh"
  },
  presentation: {
    background: { mode: "inherit-series" },
    backgroundMusic: { mode: "inherit-series" }
  },
  narration: {
    voice: { mode: "inherit-series" },
    script: {
      text: "你其实只需要解决一个：那就是，怎么与无常共处。"
    }
  },
  cards: [
    {
      id: "hook",
      role: "hook",
      spokenText: "你其实只需要解决一个：",
      caption: "你其实只需要\n解决一个",
      illustrationAssetId: "compass-direction",
      illustrationCueId: "hook"
    },
    {
      id: "claim",
      role: "claim",
      spokenText: "那就是，怎么与无常共处。",
      caption: "那就是怎么\n与无常共处",
      illustrationAssetId: "layered-path",
      illustrationCueId: "claim"
    }
  ]
};

describe("createKnowledgeExplainerNarrationScript", () => {
  it("只使用完整口播稿，不把字幕换行或卡片边界写入 TTS 文本", () => {
    expect(createKnowledgeExplainerNarrationScript(plan)).toBe("你其实只需要解决一个：那就是，怎么与无常共处。");
  });

  it("拒绝与画面字幕正文不一致的口播稿", () => {
    const mismatchedPlan: KnowledgeExplainerCreationPlan = {
      ...plan,
      narration: {
        ...plan.narration,
        script: { text: "你其实只需要解决一个：答案在别处。" }
      }
    };

    expect(() => createKnowledgeExplainerNarrationScript(mismatchedPlan))
      .toThrow("does not match the caption content");
  });

  it("制作单契约拒绝 TTS 展示换行和声画正文不一致", () => {
    const displayLineBreakPlan = {
      ...plan,
      narration: {
        ...plan.narration,
        script: { text: "你其实只需要解决一个：\n那就是，怎么与无常共处。" }
      }
    };
    const mismatchedPlan = {
      ...plan,
      narration: {
        ...plan.narration,
        script: { text: "你其实只需要解决一个：答案在别处。" }
      }
    };

    expect(KnowledgeExplainerCreationPlanSchema.safeParse(displayLineBreakPlan).success).toBe(false);
    expect(KnowledgeExplainerCreationPlanSchema.safeParse(mismatchedPlan).success).toBe(false);
  });
});
