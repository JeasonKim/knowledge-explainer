import { describe, expect, it } from "vitest";
import { moveTemplateLayerWithKeyboard } from "./template-layer-keyboard-movement";

describe("moveTemplateLayerWithKeyboard", () => {
  const canvas = { width: 1080, height: 1440, fps: 30 };

  it("按指定步长移动图层", () => {
    expect(moveTemplateLayerWithKeyboard(
      { x: 100, y: 200, width: 300, height: 120 },
      canvas,
      { direction: "right", step: 10 }
    )).toEqual({ x: 110, y: 200, width: 300, height: 120 });
  });

  it("不允许图层被键盘移出画布", () => {
    expect(moveTemplateLayerWithKeyboard(
      { x: 0, y: 1320, width: 300, height: 120 },
      canvas,
      { direction: "down", step: 10 }
    )).toEqual({ x: 0, y: 1320, width: 300, height: 120 });
  });
});
