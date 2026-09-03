import { describe, expect, it } from "vitest";
import type { VideoTemplateDesign } from "@knowledge-explainer/contracts";
import { getTemplateDesign } from "@knowledge-explainer/template-design";
import { assertTemplateDebuggingDraftKeepsContract } from "./template-debugging-boundary";

function targetDesign(): VideoTemplateDesign {
  return structuredClone(getTemplateDesign("knowledge-explainer", "illustrated-caption"));
}

describe("assertTemplateDebuggingDraftKeepsContract", () => {
  it("允许调整文字样例与已有视觉参数", () => {
    const persisted = targetDesign();
    const draft = targetDesign();
    draft.fields.find((field) => field.valueType === "text")!.sampleValue = "新预览";
    const textLayer = draft.views[0]!.layers.find((layer) => layer.text)!;
    textLayer.rect.x += 1;
    textLayer.text!.color = "#2563EB";

    expect(() => assertTemplateDebuggingDraftKeepsContract(persisted, draft)).not.toThrow();
  });

  it("拒绝修改字段结构、槽位绑定与画布结构", () => {
    const persisted = targetDesign();
    const changedField = targetDesign();
    changedField.fields[0]!.sourcePath = "another.source";
    expect(() => assertTemplateDebuggingDraftKeepsContract(persisted, changedField)).toThrow("字段、视图与槽位结构固定");

    const reboundLayer = targetDesign();
    reboundLayer.views[0]!.layers.find((layer) => layer.fieldId)!.fieldId = "another.field";
    expect(() => assertTemplateDebuggingDraftKeepsContract(persisted, reboundLayer)).toThrow("字段、视图与槽位结构固定");

    const changedCanvas = targetDesign();
    changedCanvas.views[0]!.canvas.fps += 1;
    expect(() => assertTemplateDebuggingDraftKeepsContract(persisted, changedCanvas)).toThrow("字段、视图与槽位结构固定");
  });

  it("拒绝修改图片内容与图片呈现规则", () => {
    const persisted = targetDesign();
    const changedImageValue = targetDesign();
    changedImageValue.fields.find((field) => field.valueType === "image")!.sampleValue = "sample://another-image";
    expect(() => assertTemplateDebuggingDraftKeepsContract(persisted, changedImageValue)).toThrow("图片字段暂不支持调整");

    const changedImageStyle = targetDesign();
    const imageLayer = changedImageStyle.views[0]!.layers.find((layer) => layer.image)!;
    imageLayer.image!.objectFit = imageLayer.image!.objectFit === "cover" ? "contain" : "cover";
    expect(() => assertTemplateDebuggingDraftKeepsContract(persisted, changedImageStyle)).toThrow("图片字段暂不支持调整");
  });
});
