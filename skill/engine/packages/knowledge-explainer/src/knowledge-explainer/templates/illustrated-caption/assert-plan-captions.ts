import type {
  KnowledgeExplainerCreationPlanCard,
  KnowledgeExplainerTemplateModule,
  KnowledgeExplainerVideoTemplate,
  KnowledgeExplainerCreationPlan
} from "@knowledge-explainer/contracts";
import { estimateKnowledgeExplainerTemplateTextWidth } from "@knowledge-explainer/contracts";
import { getKnowledgeExplainerTemplateModule, getKnowledgeExplainerVideoTemplate } from "./definition";
import { validateKnowledgeExplainerSemanticCaptionBreaks } from "../../caption-segmentation";

function resolveCaptionModule(template: KnowledgeExplainerVideoTemplate): KnowledgeExplainerTemplateModule {
  const caption = getKnowledgeExplainerTemplateModule(template, "caption");
  if (!caption.text || !caption.fitting) {
    throw new Error(`KnowledgeExplainer template ${template.id} requires a complete caption contract.`);
  }
  return caption;
}

function validateCaptionCard(card: KnowledgeExplainerCreationPlanCard, caption: KnowledgeExplainerTemplateModule): string[] {
  if (!caption.text || !caption.fitting) {
    return [`KnowledgeExplainer template module ${caption.id} does not define caption fitting.`];
  }
  const displayCaption = card.caption;
  const lines = displayCaption.split("\n");
  const issues: string[] = [];
  const cjkCharacterCount = [...displayCaption].filter((character) => /[\u3400-\u9FFF]/u.test(character)).length;
  if (cjkCharacterCount === 1) {
    issues.push(`card ${card.id} cannot contain a single CJK character as its complete spoken text`);
  }
  if (lines.length > caption.fitting.maxLines) {
    issues.push(`card ${card.id} exceeds the ${caption.fitting.maxLines}-line caption limit`);
  }
  for (const line of lines) {
    if (estimateKnowledgeExplainerTemplateTextWidth(line, caption.text, caption.fitting.metrics) > caption.rect.width) {
      issues.push(`card ${card.id} exceeds the fixed caption width`);
    }
  }
  return issues;
}

/**
 * 制作单必须在交给工程前完成字幕拆卡。工程只校验物理槽位，不再替 Agent 改写文案或增加镜头。
 */
export function assertKnowledgeExplainerCreationPlanCaptionsFit(
  plan: KnowledgeExplainerCreationPlan,
  templateId: KnowledgeExplainerVideoTemplate["id"]
): void {
  const caption = resolveCaptionModule(getKnowledgeExplainerVideoTemplate(templateId));
  const issues = [
    ...plan.cards.flatMap((card) => validateCaptionCard(card, caption)),
    ...validateKnowledgeExplainerSemanticCaptionBreaks(plan)
  ];
  if (issues.length > 0) {
    throw new Error(`KnowledgeExplainer plan caption validation failed: ${issues.join("; ")}`);
  }
}
