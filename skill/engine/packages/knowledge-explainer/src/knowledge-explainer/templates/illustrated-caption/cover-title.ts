export type KnowledgeExplainerCoverTitle = {
  primaryTitle: string;
  emphasisTitle: string;
};

const semanticSeparators = ["，", ",", "：", ":", "；", ";", "—", "？", "?"];
const contrastConnectors = ["也不是", "而不是", "不是", "不等于", "不要", "别让", "都要"];

function splitAt(title: string, index: number, separatorLength = 0): KnowledgeExplainerCoverTitle | undefined {
  const primaryTitle = title.slice(0, index).trim();
  const emphasisTitle = title.slice(index + separatorLength).trim();
  return primaryTitle && emphasisTitle ? { primaryTitle, emphasisTitle } : undefined;
}

/**
 * 只改变标题的视觉分层，不改写标题本身。优先尊重原有标点和转折命题，
 * 没有自然切点时再按字符数均衡分行。
 */
export function resolveKnowledgeExplainerCoverTitle(title: string): KnowledgeExplainerCoverTitle {
  const normalizedTitle = title.trim();
  if (normalizedTitle.length < 2) {
    throw new Error("Knowledge explainer cover title requires at least two characters.");
  }

  for (const separator of semanticSeparators) {
    const index = normalizedTitle.indexOf(separator);
    const separated = index >= 2
      ? splitAt(normalizedTitle, index, separator.length)
      : undefined;
    if (separated) {
      return separated;
    }
  }

  for (const connector of contrastConnectors) {
    const index = normalizedTitle.indexOf(connector);
    const separated = index >= 2 ? splitAt(normalizedTitle, index) : undefined;
    if (separated) {
      return separated;
    }
  }

  const balancedIndex = Math.ceil(normalizedTitle.length / 2);
  return splitAt(normalizedTitle, balancedIndex)
    ?? { primaryTitle: normalizedTitle.slice(0, 1), emphasisTitle: normalizedTitle.slice(1) };
}

export function resolveKnowledgeExplainerThemeTitleFontSize(
  title: string,
  availableWidth = 1000,
  preferredFontSize = 100
): number {
  const visualCharacterCount = Math.max(1, Array.from(title).length);
  const singleLineFontSize = Math.floor(availableWidth / (visualCharacterCount * 0.96));
  return Math.max(64, Math.min(preferredFontSize, singleLineFontSize));
}
