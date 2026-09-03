import type { ReactNode } from "react";
import type { KnowledgeExplainerProductionLock } from "@knowledge-explainer/contracts";
import { KnowledgeExplainerVideo } from "@knowledge-explainer/core";

export type KnowledgeExplainerCompositionProps = {
  project: KnowledgeExplainerProductionLock;
};

export function KnowledgeExplainerComposition(props: KnowledgeExplainerCompositionProps): ReactNode {
  return <KnowledgeExplainerVideo project={props.project} />;
}
