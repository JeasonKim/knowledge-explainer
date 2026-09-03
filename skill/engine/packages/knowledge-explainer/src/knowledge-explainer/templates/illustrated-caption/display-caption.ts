const DISPLAY_PUNCTUATION_PATTERN = /\p{P}/u;

export function hasKnowledgeExplainerDisplayPunctuation(text: string): boolean {
  return DISPLAY_PUNCTUATION_PATTERN.test(text);
}
