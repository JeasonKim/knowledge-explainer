import { describe, expect, it } from "vitest";
import {
  describeKnowledgeExplainerTemplate,
  getKnowledgeExplainerTemplateModule,
  getKnowledgeExplainerVideoTemplate,
  knowledgeExplainerIllustrationDisplaySpec,
  resolveKnowledgeExplainerIllustrationDisplayMetrics
} from "./definition";

describe("describeKnowledgeExplainerTemplate", () => {
  it("只向 Skill 输出写作能力，不泄漏模板坐标、字号或动画实现", () => {
    const capabilities = describeKnowledgeExplainerTemplate("illustrated-caption", "landscape-16x9");

    expect(capabilities).toMatchObject({
      templateId: "illustrated-caption",
      viewId: "landscape-16x9",
      format: { width: 1920, height: 1080, fps: 24 },
      caption: { maxLines: 2, maxCjkCharactersPerLine: 12, overflowPolicy: "reject" },
      illustration: { required: true, preferredAspectRatio: 720 / 560, fit: "contain" }
    });
    expect(capabilities).not.toHaveProperty("id");
    expect(capabilities).not.toHaveProperty("modules");
  });
});

describe("knowledge explainer illustration display contract", () => {
  it.each([
    ["portrait-3x4", { x: 120, y: 680, width: 840, height: 480 }],
    ["vertical-9x16", { x: 120, y: 820, width: 840, height: 620 }],
    ["landscape-16x9", { x: 1110, y: 210, width: 720, height: 560 }]
  ] as const)("为 %s 提供足够大的静态插图槽", (viewId, expectedRect) => {
    const template = getKnowledgeExplainerVideoTemplate("illustrated-caption", viewId);

    expect(getKnowledgeExplainerTemplateModule(template, "illustration").rect).toEqual(expectedRect);
  });

  it.each([
    "portrait-3x4",
    "vertical-9x16",
    "landscape-16x9"
  ] as const)("在 %s 的最不利资源比例下仍保持足够的图文视觉权重", (viewId) => {
    const template = getKnowledgeExplainerVideoTemplate("illustrated-caption", viewId);

    for (const aspectRatio of [
      knowledgeExplainerIllustrationDisplaySpec.minimumAssetAspectRatio,
      knowledgeExplainerIllustrationDisplaySpec.maximumAssetAspectRatio
    ]) {
      const metrics = resolveKnowledgeExplainerIllustrationDisplayMetrics(template, aspectRatio);

      expect(metrics.illustrationToCaptionAreaRatio)
        .toBeGreaterThanOrEqual(knowledgeExplainerIllustrationDisplaySpec.minimumIllustrationToCaptionAreaRatio);
    }
  });
});
