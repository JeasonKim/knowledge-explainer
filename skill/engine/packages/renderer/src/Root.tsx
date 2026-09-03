import { Composition, type CalculateMetadataFunction } from "remotion";
import { z } from "zod";
import { KnowledgeExplainerProductionLockSchema } from "@knowledge-explainer/contracts";
import studioPreviewSource from "./studio-preview.json";
import {
  KnowledgeExplainerComposition,
  type KnowledgeExplainerCompositionProps
} from "./KnowledgeExplainerComposition";

export const KnowledgeExplainerCompositionPropsSchema = z.object({
  project: KnowledgeExplainerProductionLockSchema
});

const studioPreviewProject = KnowledgeExplainerProductionLockSchema.parse(studioPreviewSource);

const calculateKnowledgeExplainerMetadata: CalculateMetadataFunction<KnowledgeExplainerCompositionProps> = ({ props }) => ({
  durationInFrames: props.project.durationInFrames,
  width: props.project.format.width,
  height: props.project.format.height,
  fps: props.project.format.fps
});

export function RemotionRoot() {
  return <Composition id="KnowledgeExplainer" component={KnowledgeExplainerComposition}
    durationInFrames={studioPreviewProject.durationInFrames} fps={studioPreviewProject.format.fps}
    width={studioPreviewProject.format.width} height={studioPreviewProject.format.height}
    defaultProps={{ project: studioPreviewProject }} schema={KnowledgeExplainerCompositionPropsSchema}
    calculateMetadata={calculateKnowledgeExplainerMetadata} />;
}
