import { describe, expect, it } from "vitest";
import { resolveKnowledgeExplainerPreviewDuration } from "./preview-duration";

describe("resolveKnowledgeExplainerPreviewDuration", () => {
  it("没有实测音频时仅使用全局默认时长做不可发布的布局预览", () => {
    const result = resolveKnowledgeExplainerPreviewDuration();

    expect(result).toEqual({ seconds: 60, source: "template-preview", warnings: [] });
  });
});
