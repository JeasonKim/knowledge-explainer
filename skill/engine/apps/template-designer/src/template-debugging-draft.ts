import type { VideoTemplateDesign } from "@knowledge-explainer/contracts";

export type TemplateDebuggingDraftStatus = "initializing" | "persisted" | "draft";

export function resolveTemplateDebuggingDraftStatus(
  persisted: VideoTemplateDesign | undefined,
  draft: VideoTemplateDesign | undefined
): TemplateDebuggingDraftStatus {
  if (!persisted || !draft) {
    return "initializing";
  }
  return JSON.stringify(persisted) === JSON.stringify(draft) ? "persisted" : "draft";
}
