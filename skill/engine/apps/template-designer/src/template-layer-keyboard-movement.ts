import type { TemplateDesignRect, TemplateDesignView } from "@knowledge-explainer/contracts";

export type TemplateLayerMovementDirection = "down" | "left" | "right" | "up";

export type TemplateLayerMovement = {
  direction: TemplateLayerMovementDirection;
  step: number;
};

export function moveTemplateLayerWithKeyboard(
  rect: TemplateDesignRect,
  canvas: TemplateDesignView["canvas"],
  movement: TemplateLayerMovement
): TemplateDesignRect {
  const horizontalOffset = movement.direction === "left"
    ? -movement.step
    : movement.direction === "right" ? movement.step : 0;
  const verticalOffset = movement.direction === "up"
    ? -movement.step
    : movement.direction === "down" ? movement.step : 0;

  return {
    ...rect,
    x: Math.max(0, Math.min(rect.x + horizontalOffset, canvas.width - rect.width)),
    y: Math.max(0, Math.min(rect.y + verticalOffset, canvas.height - rect.height))
  };
}
