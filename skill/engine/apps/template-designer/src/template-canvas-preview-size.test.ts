import { describe, expect, it } from "vitest";
import { fitTemplateCanvasPreview } from "./template-canvas-preview-size";

describe("fitTemplateCanvasPreview", () => {
  it("按高度约束完整展示竖版模板", () => {
    const preview = fitTemplateCanvasPreview(
      { width: 1080, height: 1920 },
      { width: 442, height: 530 }
    );

    expect(preview.width).toBeCloseTo(298.125);
    expect(preview.height).toBeCloseTo(530);
  });

  it("按宽度约束完整展示横版模板", () => {
    const preview = fitTemplateCanvasPreview(
      { width: 1920, height: 1080 },
      { width: 442, height: 530 }
    );

    expect(preview.width).toBeCloseTo(442);
    expect(preview.height).toBeCloseTo(248.625);
  });

  it("在没有可用区域时不生成失真的尺寸", () => {
    expect(fitTemplateCanvasPreview(
      { width: 1080, height: 1440 },
      { width: 0, height: 530 }
    )).toEqual({ width: 0, height: 0 });
  });
});
