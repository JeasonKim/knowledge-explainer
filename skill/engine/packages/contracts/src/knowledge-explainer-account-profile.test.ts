import { describe, expect, it } from "vitest";
import { KnowledgeExplainerAccountProfileSchema } from "./index";

const accountProfile = {
  kind: "knowledge-explainer-account",
  id: "block-tips",
  markText: "块",
  displayName: "@方块技巧Lab",
  positioningTags: [
    { id: "java", topLine: "Java 版", bottomLine: "实用技巧" },
    { id: "survival", topLine: "生存效率", bottomLine: "少走弯路" },
    { id: "mechanics", topLine: "机制拆解", bottomLine: "直接能用" }
  ],
  series: [{
    id: "java-survival",
    displayName: "Java 生存技巧",
    creationMethodId: "knowledge-explainer",
    themeId: "illustrated-caption-editorial",
    templateId: "illustrated-caption",
    defaultViewId: "portrait-3x4",
    signatureLine: "BLOCK TIPS LAB",
    disclaimer: "以当前版本为准\n设置可能不同",
    footerTagIds: ["java", "survival", "mechanics"],
    illustrationSystem: {
      id: "knowledge-ink-linework-v1",
      stylePrompt: "方块沙盒知识插画",
      canvas: { preferredAspectRatio: 1.6, transparentBackground: true },
      defaultNegativeRules: ["不要出现文字"]
    },
    narration: {
      voiceByLanguage: { zh: "volcengine-example-zh" },
      synthesis: { emotion: "confident", speed: 1, volume: 1 }
    },
    backgroundId: "knowledge-cool-grey",
    backgroundMusicId: "none"
  }]
};

describe("KnowledgeExplainerAccountProfileSchema", () => {
  it("要求右下固定提示恰好为两行，且每行不超过模板容量", () => {
    expect(KnowledgeExplainerAccountProfileSchema.safeParse(accountProfile).success).toBe(true);
    expect(KnowledgeExplainerAccountProfileSchema.safeParse({
      ...accountProfile,
      series: [{ ...accountProfile.series[0], disclaimer: "以当前版本为准\n设置可能不同\n请以实际为准" }]
    }).success).toBe(false);
    expect(KnowledgeExplainerAccountProfileSchema.safeParse({
      ...accountProfile,
      series: [{ ...accountProfile.series[0], disclaimer: "这是超过八个字符的提示文案\n设置可能不同" }]
    }).success).toBe(false);
  });
});
