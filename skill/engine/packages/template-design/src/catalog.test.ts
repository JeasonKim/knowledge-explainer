import { describe, expect, it } from "vitest";
import { getTemplateDesign, getTemplateDesignLayer, listTemplateDesigns } from "./catalog";

describe("知识讲解模板目录", () => {
  it("只公开插画字幕模板", () => {
    expect(listTemplateDesigns().map((template) => [template.creationMethodId, template.id]))
      .toEqual([["knowledge-explainer", "illustrated-caption"]]);
  });

  it("读取正式字幕槽位", () => {
    const template = getTemplateDesign("knowledge-explainer", "illustrated-caption");
    expect(getTemplateDesignLayer(template, "portrait-3x4", "caption").fieldId).toBe("scene.caption");
  });

  it("拒绝未知模板", () => {
    expect(() => getTemplateDesign("knowledge-explainer", "unknown")).toThrow("Unknown template design");
  });
});
