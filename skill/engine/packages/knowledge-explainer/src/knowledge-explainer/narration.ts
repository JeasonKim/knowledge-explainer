import {
  normalizeNarrationContent,
  type KnowledgeExplainerCreationPlan
} from "@knowledge-explainer/contracts";

export function createKnowledgeExplainerNarrationScript(plan: KnowledgeExplainerCreationPlan): string {
  const script = plan.narration.script.text.trim();
  if (/[\r\n]/.test(script)) {
    throw new Error(`KnowledgeExplainer narration script ${plan.id} cannot contain display line breaks.`);
  }

  // 口播正文和画面字幕由不同层负责，但必须讲述同一份内容，避免制作单绕过 schema 时出现声画不一致。
  const narrationContent = normalizeNarrationContent(script);
  const captionContent = normalizeNarrationContent(plan.cards.map((card) => card.spokenText).join(""));
  if (narrationContent !== captionContent) {
    throw new Error(`KnowledgeExplainer narration script ${plan.id} does not match the caption content.`);
  }
  return script;
}
