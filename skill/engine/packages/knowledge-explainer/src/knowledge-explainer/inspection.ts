import type { KnowledgeExplainerProductionLock, KnowledgeExplainerScene } from "@knowledge-explainer/contracts";

export type KnowledgeExplainerInspectionPhase =
  | "cover"
  | "scene-start"
  | "scene-middle"
  | "scene-end"
  | "closing";

export type KnowledgeExplainerInspectionFrame = {
  shotId: string;
  phase: KnowledgeExplainerInspectionPhase;
  frame: number;
};

function finalFrame(scene: KnowledgeExplainerScene): number {
  return Math.max(scene.startFrame, scene.endFrame - 1);
}

export function planKnowledgeExplainerInspectionFrames(
  project: KnowledgeExplainerProductionLock
): KnowledgeExplainerInspectionFrame[] {
  const sceneFrames = project.scenes.flatMap((scene) => [
    { shotId: scene.id, phase: "scene-start" as const, frame: scene.startFrame },
    { shotId: scene.id, phase: "scene-middle" as const, frame: Math.floor((scene.startFrame + finalFrame(scene)) / 2) },
    { shotId: scene.id, phase: "scene-end" as const, frame: finalFrame(scene) }
  ]);
  return [
    { shotId: "theme-cover", phase: "cover", frame: 0 },
    ...sceneFrames,
    { shotId: "theme-closing", phase: "closing", frame: project.durationInFrames - 1 }
  ];
}
