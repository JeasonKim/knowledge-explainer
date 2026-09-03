import { describe, expect, it } from "vitest";
import { VideoTemplateDesignSchema } from "./index";

const templateDesign = {
  kind: "video-template-design",
  id: "illustrated-caption",
  creationMethodId: "knowledge-explainer",
  displayName: "插画字幕",
  fields: [
    {
      id: "scene.caption",
      displayName: "当前字幕",
      valueType: "text",
      scope: "scene",
      required: true,
      sourcePath: "cards[].caption",
      sampleValue: "把复杂的问题讲明白",
      constraints: {
        allowedValues: ["把复杂的问题讲明白", "换一个字幕样例"]
      }
    },
    {
      id: "scene.illustration",
      displayName: "当前插画",
      valueType: "image",
      scope: "scene",
      required: true,
      sourcePath: "cards[].illustrationAssetId",
      sampleValue: "sample://illustration"
    }
  ],
  views: [{
    id: "portrait-3x4",
    displayName: "3:4 竖版",
    canvas: { width: 1080, height: 1440, fps: 24 },
    safeArea: { top: 56, right: 48, bottom: 128, left: 48 },
    layers: [
      {
        id: "caption",
        displayName: "字幕",
        kind: "text",
        scope: "scene",
        fieldId: "scene.caption",
        zIndex: 20,
        rect: { x: 150, y: 316, width: 780, height: 196 },
        text: {
          fontFamily: "PingFang SC",
          fontSize: 74,
          fontWeight: 900,
          lineHeight: 1.16,
          letterSpacing: 0,
          textAlign: "center",
          color: "#000000",
          accentColor: "#FFE81F",
          maxLines: 2,
          strokeColor: "#101010",
          strokeWidth: 3,
          shadow: {
            color: "#000000",
            opacity: 0.42,
            offsetX: 0,
            offsetY: 6,
            blur: 10
          }
        }
      },
      {
        id: "illustration",
        displayName: "插画",
        kind: "image",
        scope: "scene",
        fieldId: "scene.illustration",
        zIndex: 10,
        rect: { x: 120, y: 680, width: 840, height: 480 },
        image: { objectFit: "contain" }
      }
    ]
  }]
};

describe("VideoTemplateDesignSchema", () => {
  it("让模板同时声明 Agent 数据字段与画布槽位", () => {
    const result = VideoTemplateDesignSchema.parse(templateDesign);

    expect(result.fields[0]?.sourcePath).toBe("cards[].caption");
    expect(result.views[0]?.layers[0]?.fieldId).toBe("scene.caption");
    expect(result.fields[0]?.constraints?.allowedValues).toEqual([
      "把复杂的问题讲明白",
      "换一个字幕样例"
    ]);
    expect(result.views[0]?.layers[0]?.text?.accentColor).toBe("#FFE81F");
  });

  it("拒绝枚举字段使用未声明的样例值", () => {
    const unknownAllowedValue = structuredClone(templateDesign);
    unknownAllowedValue.fields[0]!.sampleValue = "未登记值";

    expect(() => VideoTemplateDesignSchema.parse(unknownAllowedValue)).toThrow("allowedValues");
  });

  it("拒绝将槽位绑定到不存在或作用域不一致的数据字段", () => {
    const unknownField = structuredClone(templateDesign);
    unknownField.views[0]!.layers[0]!.fieldId = "scene.unknown";
    expect(() => VideoTemplateDesignSchema.parse(unknownField)).toThrow("unknown field");

    const incompatibleScope = structuredClone(templateDesign);
    incompatibleScope.fields[0]!.scope = "static";
    expect(() => VideoTemplateDesignSchema.parse(incompatibleScope)).toThrow("does not match field scope");
  });

  it("拒绝越出画布或重复的槽位", () => {
    const outOfCanvas = structuredClone(templateDesign);
    outOfCanvas.views[0]!.layers[0]!.rect.x = 900;
    expect(() => VideoTemplateDesignSchema.parse(outOfCanvas)).toThrow("exceeds the template canvas");

    const duplicateLayer = structuredClone(templateDesign);
    duplicateLayer.views[0]!.layers.push(structuredClone(duplicateLayer.views[0]!.layers[0]!));
    expect(() => VideoTemplateDesignSchema.parse(duplicateLayer)).toThrow("duplicate layer id");
  });
});
