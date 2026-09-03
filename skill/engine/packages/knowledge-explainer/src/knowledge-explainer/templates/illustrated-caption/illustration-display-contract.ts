export type IllustrationDisplayDimensions = {
  width: number;
  height: number;
};

export type IllustrationDisplayRect = IllustrationDisplayDimensions & {
  x: number;
  y: number;
};

export const knowledgeExplainerIllustrationDisplaySpec = {
  minimumAssetAspectRatio: 0.6,
  maximumAssetAspectRatio: 1.6,
  minimumIllustrationToCaptionAreaRatio: 0.9
} as const;

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
}

/**
 * 确保透明主体归一化后的资源比例能在所有知识讲解视图中保持足够视觉权重。
 */
export function assertKnowledgeExplainerIllustrationAspectRatio(
  dimensions: IllustrationDisplayDimensions
): void {
  assertPositiveFinite(dimensions.width, "illustration width");
  assertPositiveFinite(dimensions.height, "illustration height");
  const aspectRatio = dimensions.width / dimensions.height;
  if (
    aspectRatio < knowledgeExplainerIllustrationDisplaySpec.minimumAssetAspectRatio ||
    aspectRatio > knowledgeExplainerIllustrationDisplaySpec.maximumAssetAspectRatio
  ) {
    throw new Error(
      `Knowledge explainer illustration aspect ratio ${aspectRatio.toFixed(3)} must be within ` +
      `[${knowledgeExplainerIllustrationDisplaySpec.minimumAssetAspectRatio}, ` +
      `${knowledgeExplainerIllustrationDisplaySpec.maximumAssetAspectRatio}].`
    );
  }
}

export function resolveContainedIllustrationDimensions(
  slot: IllustrationDisplayDimensions,
  assetAspectRatio: number
): IllustrationDisplayDimensions {
  assertPositiveFinite(slot.width, "illustration slot width");
  assertPositiveFinite(slot.height, "illustration slot height");
  assertPositiveFinite(assetAspectRatio, "illustration asset aspect ratio");
  const slotAspectRatio = slot.width / slot.height;
  if (assetAspectRatio >= slotAspectRatio) {
    return {
      width: slot.width,
      height: slot.width / assetAspectRatio
    };
  }
  return {
    width: slot.height * assetAspectRatio,
    height: slot.height
  };
}
