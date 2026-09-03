export type TemplateCanvasDimensions = {
  width: number;
  height: number;
};

export type TemplateCanvasPreviewArea = {
  width: number;
  height: number;
};

export type TemplateCanvasPreviewSize = {
  width: number;
  height: number;
};

/**
 * 保持视频画布比例，在调试器给定的可视区域内完整展示。
 */
export function fitTemplateCanvasPreview(
  canvas: TemplateCanvasDimensions,
  area: TemplateCanvasPreviewArea
): TemplateCanvasPreviewSize {
  const availableWidth = Math.max(0, area.width);
  const availableHeight = Math.max(0, area.height);
  const scale = Math.min(availableWidth / canvas.width, availableHeight / canvas.height);

  if (!Number.isFinite(scale) || scale <= 0) {
    return { width: 0, height: 0 };
  }

  return {
    width: canvas.width * scale,
    height: canvas.height * scale
  };
}
