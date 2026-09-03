import type {
  KnowledgeExplainerProductionLock,
  KnowledgeExplainerScene,
  NarrationSegment
} from "@knowledge-explainer/contracts";
import {
  estimateKnowledgeExplainerTemplateTextWidth,
  normalizeNarrationContent
} from "@knowledge-explainer/contracts";
import { getKnowledgeExplainerTemplateModule, getKnowledgeExplainerVideoTemplate } from "./templates/illustrated-caption/definition";
import { resolveKnowledgeExplainerFramingDuration } from "./templates/illustrated-caption/framing-contract";
import {
  hasKnowledgeExplainerDisplayPunctuation
} from "./templates/illustrated-caption/display-caption";

export type KnowledgeExplainerProductionValidationIssue = string;

export function validateKnowledgeExplainerFramingContract(
  project: KnowledgeExplainerProductionLock
): KnowledgeExplainerProductionValidationIssue[] {
  const expected = resolveKnowledgeExplainerFramingDuration(project.format.fps);
  const issues: KnowledgeExplainerProductionValidationIssue[] = [];
  if (project.framing.introDurationInFrames !== expected.introDurationInFrames) {
    issues.push(
      `knowledge explainer theme cover must be exactly ${expected.introDurationInFrames} frames at ${project.format.fps} fps`
    );
  }
  if (project.framing.outroDurationInFrames !== expected.outroDurationInFrames) {
    issues.push(
      `knowledge explainer theme closing must be exactly ${expected.outroDurationInFrames} frames at ${project.format.fps} fps`
    );
  }
  return issues;
}

export function validateKnowledgeExplainerSceneCoverage(
  project: KnowledgeExplainerProductionLock
): KnowledgeExplainerProductionValidationIssue[] {
  const issues: KnowledgeExplainerProductionValidationIssue[] = [];
  const scenes = [...project.scenes].sort((left, right) => left.startFrame - right.startFrame);
  const contentStartFrame = project.framing.introDurationInFrames;
  const contentEndFrame = project.durationInFrames - project.framing.outroDurationInFrames;
  let expectedStart = contentStartFrame;
  if (scenes[0]?.startFrame !== contentStartFrame) {
    issues.push(`knowledge explainer scenes must begin after the ${contentStartFrame}-frame theme cover`);
  }
  for (const scene of scenes) {
    if (scene.startFrame !== expectedStart) {
      issues.push(`knowledge explainer scene ${scene.id} must begin at frame ${expectedStart}`);
    }
    if (scene.endFrame <= scene.startFrame || scene.endFrame > contentEndFrame) {
      issues.push(`knowledge explainer scene ${scene.id} has an invalid frame range`);
    }
    expectedStart = scene.endFrame;
  }
  if (expectedStart !== contentEndFrame) {
    issues.push(`knowledge explainer scenes must end before the theme closing at frame ${contentEndFrame}`);
  }
  return issues;
}

function validateIllustrationCueCoverage(
  project: KnowledgeExplainerProductionLock
): KnowledgeExplainerProductionValidationIssue[] {
  if (!project.illustrationCues) {
    return [];
  }
  const issues: KnowledgeExplainerProductionValidationIssue[] = [];
  const cues = [...project.illustrationCues].sort((left, right) => left.startFrame - right.startFrame);
  const contentStartFrame = project.framing.introDurationInFrames;
  const contentEndFrame = project.durationInFrames - project.framing.outroDurationInFrames;
  let expectedStartFrame = contentStartFrame;
  for (const cue of cues) {
    if (cue.startFrame !== expectedStartFrame || cue.endFrame <= cue.startFrame || cue.endFrame > contentEndFrame) {
      issues.push(`knowledge explainer illustration cue ${cue.id} has an invalid frame range`);
    }
    expectedStartFrame = cue.endFrame;
  }
  if (expectedStartFrame !== contentEndFrame) {
    issues.push(`knowledge explainer illustration cues must end before the theme closing at frame ${contentEndFrame}`);
  }

  for (const scene of project.scenes) {
    const cueId = scene.illustrationCueId ?? scene.id;
    const cue = cues.find((candidate) => candidate.id === cueId);
    if (!cue) {
      issues.push(`knowledge explainer scene ${scene.id} references missing illustration cue ${cueId}`);
      continue;
    }
    if (cue.startFrame > scene.startFrame || cue.endFrame < scene.endFrame) {
      issues.push(`knowledge explainer illustration cue ${cue.id} does not cover scene ${scene.id}`);
    }
    if (cue.illustration.assetId !== scene.illustration.assetId) {
      issues.push(`knowledge explainer illustration cue ${cue.id} does not match scene ${scene.id} asset`);
    }
  }
  return issues;
}

function validateNarrationSegment(
  project: KnowledgeExplainerProductionLock,
  segment: NarrationSegment,
  previousSegment: NarrationSegment | undefined
): KnowledgeExplainerProductionValidationIssue[] {
  const contentStartFrame = project.framing.introDurationInFrames;
  const contentEndFrame = project.durationInFrames - project.framing.outroDurationInFrames;
  if (
    segment.startFrame < contentStartFrame
    || segment.endFrame <= segment.startFrame
    || segment.endFrame > contentEndFrame
  ) {
    return [`knowledge explainer narration ${segment.id} has an invalid frame range`];
  }
  if (previousSegment && segment.startFrame < previousSegment.endFrame) {
    return [`knowledge explainer narration ${segment.id} overlaps ${previousSegment.id}`];
  }
  if (normalizeNarrationContent(segment.caption) !== normalizeNarrationContent(segment.text)) {
    return [`knowledge explainer narration ${segment.id} display caption must match narration text`];
  }
  return [];
}

function validateThemeFraming(
  project: KnowledgeExplainerProductionLock
): KnowledgeExplainerProductionValidationIssue[] {
  const issues: KnowledgeExplainerProductionValidationIssue[] = [];
  const firstScene = project.scenes[0];
  const lastScene = project.scenes.at(-1);
  if (firstScene && project.framing.cover.illustration.assetId !== firstScene.illustration.assetId) {
    issues.push("knowledge explainer theme cover must use the first scene illustration");
  }
  if (lastScene && project.framing.closing.illustration.assetId !== lastScene.illustration.assetId) {
    issues.push("knowledge explainer theme closing must use the last scene illustration");
  }
  return issues;
}

function validateCaption(scene: KnowledgeExplainerScene, project: KnowledgeExplainerProductionLock): KnowledgeExplainerProductionValidationIssue[] {
  const template = getKnowledgeExplainerVideoTemplate(project.templateId, project.view.id);
  const caption = getKnowledgeExplainerTemplateModule(template, "caption");
  if (!caption.text || !caption.fitting) {
    return [`knowledge explainer template ${template.id} must define caption fitting`];
  }
  const issues: KnowledgeExplainerProductionValidationIssue[] = [
    ...validateKnowledgeExplainerDisplayCaptionText(scene.headline, scene.id)
  ];
  const lines = scene.headline.split("\n");
  if (lines.length > caption.fitting.maxLines) {
    issues.push(`knowledge explainer scene ${scene.id} exceeds the caption line count`);
  }
  for (const line of lines) {
    if (estimateKnowledgeExplainerTemplateTextWidth(line, caption.text, caption.fitting.metrics) > caption.rect.width) {
      issues.push(`knowledge explainer scene ${scene.id} exceeds the caption width`);
    }
  }
  return issues;
}

export function validateKnowledgeExplainerDisplayCaptionText(
  text: string,
  sceneId: string
): KnowledgeExplainerProductionValidationIssue[] {
  if (hasKnowledgeExplainerDisplayPunctuation(text)) {
    return [`knowledge explainer scene ${sceneId} display caption cannot contain punctuation`];
  }
  return [];
}

export function validateKnowledgeExplainerProduction(
  project: KnowledgeExplainerProductionLock
): KnowledgeExplainerProductionValidationIssue[] {
  const issues = [
    ...validateKnowledgeExplainerFramingContract(project),
    ...validateKnowledgeExplainerSceneCoverage(project),
    ...validateIllustrationCueCoverage(project),
    ...validateThemeFraming(project)
  ];
  if (project.narration.timingSource === "preview") {
    issues.push("knowledge explainer production requires synthesized narration timing before rendering");
  }
  if (project.format.width !== project.view.format.width || project.format.height !== project.view.format.height || project.format.fps !== project.view.format.fps) {
    issues.push("knowledge explainer project format must match its locked output view");
  }
  const narration = [...project.narration.segments].sort((left, right) => left.startFrame - right.startFrame);
  for (const [index, segment] of narration.entries()) {
    issues.push(...validateNarrationSegment(project, segment, narration[index - 1]));
  }
  for (const scene of project.scenes) {
    if (scene.layoutRenderer !== "knowledge-explainer-caption" || !scene.illustration) {
      issues.push(`knowledge explainer scene ${scene.id} requires a caption and illustration`);
      continue;
    }
    if (scene.headline !== project.narration.segments.find((segment) => segment.id === scene.id)?.caption) {
      issues.push(`knowledge explainer scene ${scene.id} subtitle must equal its display caption`);
    }
    issues.push(...validateCaption(scene, project));
  }
  return issues;
}
