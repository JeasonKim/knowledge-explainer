import { describe, expect, it } from "vitest";
import { resolveTemplateDesignFile } from "./template-design-path";

const engineRoot = "/project/skill/engine";

describe("模板契约文件路径", () => {
  it("只解析引擎内对应方法和模板的正式契约文件", () => {
    expect(resolveTemplateDesignFile({
      engineRoot,
      creationMethodId: "knowledge-explainer",
      templateId: "illustrated-caption"
    })).toEqual({
      absolutePath: "/project/skill/engine/packages/template-design/src/templates/knowledge-explainer/illustrated-caption/template.json",
      relativePath: "knowledge-explainer/illustrated-caption/template.json"
    });
  });

  it("拒绝路径穿越与未知创作方法", () => {
    expect(() => resolveTemplateDesignFile({
      engineRoot,
      creationMethodId: "knowledge-explainer",
      templateId: "../secrets"
    })).toThrow("Template id");
    expect(() => resolveTemplateDesignFile({
      engineRoot,
      creationMethodId: "../knowledge-explainer",
      templateId: "illustrated-caption"
    })).toThrow("creation method");
  });
});
