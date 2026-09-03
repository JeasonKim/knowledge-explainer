import {
  assertKnowledgeExplainerIllustrationAspectRatio
} from "../../packages/knowledge-explainer/src/knowledge-explainer/templates/illustrated-caption/illustration-display-contract";

export { assertKnowledgeExplainerIllustrationAspectRatio };

export type IllustrationCanvas = {
  width: number;
  height: number;
};

export type IllustrationSubjectBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type IllustrationSubjectCrop = IllustrationSubjectBounds & {
  subjectLongEdgeRatio: number;
};

export const knowledgeExplainerIllustrationSubjectSpec = {
  alphaThreshold: 16,
  safetyPaddingRatio: 0.06,
  minimumLongEdgeRatio: 0.82,
  maximumLongEdgeRatio: 0.98
} as const;

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

/**
 * 将透明主体收紧为稳定资产画布，避免母版格位中的空白被带入视频模板。
 */
export function resolveIllustrationSubjectCrop(
  canvas: IllustrationCanvas,
  subject: IllustrationSubjectBounds
): IllustrationSubjectCrop {
  assertPositiveInteger(canvas.width, "illustration canvas width");
  assertPositiveInteger(canvas.height, "illustration canvas height");
  assertPositiveInteger(subject.width, "illustration subject width");
  assertPositiveInteger(subject.height, "illustration subject height");
  if (!Number.isInteger(subject.x) || !Number.isInteger(subject.y) || subject.x < 0 || subject.y < 0) {
    throw new Error("Illustration subject origin must use non-negative integer coordinates.");
  }
  if (subject.x + subject.width > canvas.width || subject.y + subject.height > canvas.height) {
    throw new Error("Illustration subject bounds must stay inside the source canvas.");
  }

  const horizontalPadding = Math.ceil(subject.width * knowledgeExplainerIllustrationSubjectSpec.safetyPaddingRatio);
  const verticalPadding = Math.ceil(subject.height * knowledgeExplainerIllustrationSubjectSpec.safetyPaddingRatio);
  const x = Math.max(0, subject.x - horizontalPadding);
  const y = Math.max(0, subject.y - verticalPadding);
  const right = Math.min(canvas.width, subject.x + subject.width + horizontalPadding);
  const bottom = Math.min(canvas.height, subject.y + subject.height + verticalPadding);
  const width = right - x;
  const height = bottom - y;
  const subjectLongEdgeRatio = subject.width >= subject.height
    ? subject.width / width
    : subject.height / height;

  if (
    subjectLongEdgeRatio < knowledgeExplainerIllustrationSubjectSpec.minimumLongEdgeRatio ||
    subjectLongEdgeRatio > knowledgeExplainerIllustrationSubjectSpec.maximumLongEdgeRatio
  ) {
    throw new Error(
      `Illustration subject long-edge ratio ${subjectLongEdgeRatio.toFixed(3)} must be within ` +
      `[${knowledgeExplainerIllustrationSubjectSpec.minimumLongEdgeRatio}, ` +
      `${knowledgeExplainerIllustrationSubjectSpec.maximumLongEdgeRatio}].`
    );
  }
  return { x, y, width, height, subjectLongEdgeRatio };
}
