import {
  normalizeNarrationContent,
  type KnowledgeExplainerCreationPlan
} from "@knowledge-explainer/contracts";

export type KnowledgeExplainerCaptionSegmentationIssue = string;

function countCaptionCharacters(text: string): number {
  return [...normalizeNarrationContent(text)].length;
}

function collectDisplayBoundaries(plan: KnowledgeExplainerCreationPlan): {
  boundaries: number[];
  lineLengths: number[];
} {
  const boundaries: number[] = [];
  const lineLengths: number[] = [];
  let offset = 0;
  for (const card of plan.cards) {
    for (const line of card.caption.split("\n")) {
      const lineLength = countCaptionCharacters(line);
      lineLengths.push(lineLength);
      offset += lineLength;
      boundaries.push(offset);
    }
  }
  boundaries.pop();
  return { boundaries, lineLengths };
}

function collectNarrationPunctuationBoundaries(script: string): Set<number> {
  const boundaries = new Set<number>();
  let offset = 0;
  for (const character of script.normalize("NFKC")) {
    if (/[\p{L}\p{N}]/u.test(character)) {
      offset += 1;
    } else if (/\p{P}/u.test(character)) {
      boundaries.add(offset);
    }
  }
  return boundaries;
}

function resolveMostCommonLineLength(lineLengths: number[]): number {
  const frequencies = new Map<number, number>();
  for (const lineLength of lineLengths) {
    frequencies.set(lineLength, (frequencies.get(lineLength) ?? 0) + 1);
  }
  return Math.max(0, ...frequencies.values());
}

/**
 * 长字幕如果大量行都停在同一字符数、同时又很少落在自然标点处，通常是机械定长切片。
 */
export function validateKnowledgeExplainerSemanticCaptionBreaks(
  plan: KnowledgeExplainerCreationPlan
): KnowledgeExplainerCaptionSegmentationIssue[] {
  const { boundaries, lineLengths } = collectDisplayBoundaries(plan);
  if (lineLengths.length < 12 || boundaries.length === 0) {
    return [];
  }

  const punctuationBoundaries = collectNarrationPunctuationBoundaries(plan.narration.script.text);
  const punctuationAlignedCount = boundaries.filter((boundary) => punctuationBoundaries.has(boundary)).length;
  const punctuationAlignedRatio = punctuationAlignedCount / boundaries.length;
  const fixedLengthRatio = resolveMostCommonLineLength(lineLengths) / lineLengths.length;

  if (fixedLengthRatio >= 0.45 && punctuationAlignedRatio < 0.5) {
    return [
      `knowledge explainer plan ${plan.id} caption layout appears mechanically split by fixed character count`
    ];
  }
  return [];
}
