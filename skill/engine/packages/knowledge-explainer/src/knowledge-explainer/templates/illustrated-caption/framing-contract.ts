export type KnowledgeExplainerFramingDuration = {
  introDurationInFrames: number;
  outroDurationInFrames: number;
};

export const knowledgeExplainerFramingContract = {
  themeCoverSeconds: 0.5,
  themeClosingSeconds: 1.25
} as const;

/**
 * 封面只承担快速识别主题的职责，必须在半秒后让出口播；
 * 收束页不抢正文注意力，可以保留更长的阅读时间。
 */
export function resolveKnowledgeExplainerFramingDuration(
  fps: number
): KnowledgeExplainerFramingDuration {
  return {
    introDurationInFrames: Math.round(knowledgeExplainerFramingContract.themeCoverSeconds * fps),
    outroDurationInFrames: Math.round(knowledgeExplainerFramingContract.themeClosingSeconds * fps)
  };
}
