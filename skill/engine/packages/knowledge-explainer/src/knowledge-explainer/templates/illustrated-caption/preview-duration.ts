export type NarrationDuration = {
  seconds: number;
  source: "template-preview" | "measured";
  warnings: string[];
};

export function resolveKnowledgeExplainerPreviewDuration(): NarrationDuration {
  return {
    seconds: 60,
    source: "template-preview",
    warnings: []
  };
}
