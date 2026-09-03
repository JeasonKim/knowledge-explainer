import { describe, expect, it } from "vitest";
import { getTemplateDesign } from "@knowledge-explainer/template-design";
import { resolveTemplateDebuggingDraftStatus } from "./template-debugging-draft";

describe("模板调试草稿状态", () => {
  it("内容改变时标记草稿，恢复后回到已保存状态", () => {
    const persisted = structuredClone(getTemplateDesign("knowledge-explainer", "illustrated-caption"));
    const draft = structuredClone(persisted);
    const field = draft.fields.find((candidate) => candidate.valueType === "text")!;
    const original = field.sampleValue;
    field.sampleValue = "新预览";
    expect(resolveTemplateDebuggingDraftStatus(persisted, draft)).toBe("draft");
    field.sampleValue = original;
    expect(resolveTemplateDebuggingDraftStatus(persisted, draft)).toBe("persisted");
  });

  it("缺少任一版本时保持初始化状态", () => {
    expect(resolveTemplateDebuggingDraftStatus(undefined, undefined)).toBe("initializing");
  });
});
