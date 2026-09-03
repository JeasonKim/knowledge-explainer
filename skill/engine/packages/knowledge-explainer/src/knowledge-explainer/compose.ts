import {
  KnowledgeExplainerProductionLockSchema,
  type KnowledgeExplainerAccountProfile,
  type KnowledgeExplainerBackground,
  type KnowledgeExplainerBackgroundMusic,
  type KnowledgeExplainerFooterColumn,
  type KnowledgeExplainerIllustrationCatalog,
  type KnowledgeExplainerMediaCatalog,
  type KnowledgeExplainerMediaSelection,
  type KnowledgeExplainerCreationPlanCard,
  type KnowledgeExplainerSeriesProfile,
  type KnowledgeExplainerVoiceSelection,
  type KnowledgeExplainerIllustrationCue,
  type KnowledgeExplainerFraming,
  type KnowledgeExplainerProductionLock,
  type KnowledgeExplainerCreationPlan,
  type KnowledgeExplainerIdentity,
  type KnowledgeExplainerScene,
  type KnowledgeExplainerViewId,
  type NarrationTimingMap,
  type NarrationSegment,
  type ResolvedKnowledgeExplainerIllustration,
  type TtsCatalog,
  type TtsVoiceProfile
} from "@knowledge-explainer/contracts";
import {
  findLayoutCandidates,
  getKnowledgeExplainerVideoTemplate,
  getKnowledgeExplainerViewProfile,
  type SceneLayoutContract
} from "./templates/illustrated-caption/definition";
import { allocateNarrationTimeline, resolveMeasuredNarrationTimeline, type NarrationTimelineRange } from "@knowledge-explainer/narration";
import { assertKnowledgeExplainerCreationPlanCaptionsFit } from "./templates/illustrated-caption/assert-plan-captions";
import { resolveKnowledgeExplainerPreviewDuration, type NarrationDuration } from "./templates/illustrated-caption/preview-duration";
import { resolveKnowledgeExplainerCoverTitle } from "./templates/illustrated-caption/cover-title";
import { resolveKnowledgeExplainerFramingDuration } from "./templates/illustrated-caption/framing-contract";

export type ComposeKnowledgeExplainerProductionOptions = {
  narrationAudioPath: string;
  voiceCatalog: TtsCatalog;
  mediaCatalog: KnowledgeExplainerMediaCatalog;
  illustrationCatalog: KnowledgeExplainerIllustrationCatalog;
  narrationTimingMap?: NarrationTimingMap;
  viewId?: KnowledgeExplainerViewId;
  preview?: boolean;
  seed?: number;
};

export type KnowledgeExplainerProductionComposition = {
  lock: KnowledgeExplainerProductionLock;
  duration: NarrationDuration;
};

export type KnowledgeExplainerNarrationPlan = {
  language: KnowledgeExplainerCreationPlan["episode"]["language"];
  voiceProfileId: string;
  synthesis: KnowledgeExplainerSeriesProfile["narration"]["synthesis"];
};

function stableSeed(text: string): number {
  let value = 2166136261;
  for (const character of text) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value | 0;
}

function resolveKnowledgeExplainerSeries(
  account: KnowledgeExplainerAccountProfile,
  plan: KnowledgeExplainerCreationPlan
): KnowledgeExplainerSeriesProfile {
  if (plan.episode.accountId !== account.id) {
    throw new Error(
      `KnowledgeExplainer plan ${plan.id} account=${plan.episode.accountId} does not match account profile ${account.id}.`
    );
  }
  const series = account.series.find((candidate) => candidate.id === plan.episode.seriesId);
  if (!series) {
    throw new Error(`KnowledgeExplainer account ${account.id} does not define series ${plan.episode.seriesId}.`);
  }
  return series;
}

function resolveFooterColumns(
  account: KnowledgeExplainerAccountProfile,
  series: KnowledgeExplainerSeriesProfile
): KnowledgeExplainerFooterColumn[] {
  const knownTags = new Map(account.positioningTags.map((tag) => [tag.id, tag]));
  return series.footerTagIds.map((tagId) => {
    const positioningTag = knownTags.get(tagId);
    if (!positioningTag) {
      throw new Error(
        `KnowledgeExplainer series ${series.id} references unknown positioning tag ${tagId} from account ${account.id}.`
      );
    }
    return { topLine: positioningTag.topLine, bottomLine: positioningTag.bottomLine };
  });
}

function resolveSelectedMediaId(
  selection: KnowledgeExplainerMediaSelection | undefined,
  seriesDefaultId: string
): string {
  return selection?.mode === "override" ? selection.mediaId : seriesDefaultId;
}

function resolveSelectedVoiceId(
  selection: KnowledgeExplainerVoiceSelection | undefined,
  series: KnowledgeExplainerSeriesProfile,
  language: KnowledgeExplainerCreationPlan["episode"]["language"]
): string {
  if (selection?.mode === "override") {
    return selection.voiceProfileId;
  }
  const seriesVoiceId = series.narration.voiceByLanguage[language];
  if (!seriesVoiceId) {
    throw new Error(`KnowledgeExplainer series ${series.id} does not define a ${language} narration voice.`);
  }
  return seriesVoiceId;
}

export function resolveKnowledgeExplainerNarrationPlan(
  account: KnowledgeExplainerAccountProfile,
  plan: KnowledgeExplainerCreationPlan
): KnowledgeExplainerNarrationPlan {
  const series = resolveKnowledgeExplainerSeries(account, plan);
  return {
    language: plan.episode.language,
    voiceProfileId: resolveSelectedVoiceId(plan.narration.voice, series, plan.episode.language),
    synthesis: series.narration.synthesis
  };
}

function resolveKnowledgeExplainerBackground(mediaCatalog: KnowledgeExplainerMediaCatalog, backgroundId: string): KnowledgeExplainerBackground {
  const background = mediaCatalog.backgrounds.find((candidate) => candidate.id === backgroundId);
  if (!background) {
    throw new Error(`KnowledgeExplainer media catalog does not define background ${backgroundId}.`);
  }
  return background;
}

function resolveKnowledgeExplainerBackgroundMusic(mediaCatalog: KnowledgeExplainerMediaCatalog, musicId: string): KnowledgeExplainerBackgroundMusic {
  const music = mediaCatalog.backgroundMusic.find((candidate) => candidate.id === musicId);
  if (!music) {
    throw new Error(`KnowledgeExplainer media catalog does not define background music ${musicId}.`);
  }
  if (music.status !== "active") {
    throw new Error(`KnowledgeExplainer background music ${musicId} is pending and cannot be selected for production.`);
  }
  return music;
}

function resolveKnowledgeExplainerIdentity(
  account: KnowledgeExplainerAccountProfile,
  series: KnowledgeExplainerSeriesProfile,
  plan: KnowledgeExplainerCreationPlan,
  mediaCatalog: KnowledgeExplainerMediaCatalog
): KnowledgeExplainerIdentity {
  const narration = resolveKnowledgeExplainerNarrationPlan(account, plan);
  return {
    accountId: account.id,
    accountMarkText: account.markText,
    accountName: account.displayName,
    seriesId: series.id,
    seriesName: series.displayName,
    episodeTitle: plan.episode.title,
    signatureLine: series.signatureLine,
    disclaimer: series.disclaimer,
    footerColumns: resolveFooterColumns(account, series),
    illustrationSystem: series.illustrationSystem,
    narration,
    background: resolveKnowledgeExplainerBackground(
      mediaCatalog,
      resolveSelectedMediaId(plan.presentation?.background, series.backgroundId)
    ),
    backgroundMusic: resolveKnowledgeExplainerBackgroundMusic(
      mediaCatalog,
      resolveSelectedMediaId(plan.presentation?.backgroundMusic, series.backgroundMusicId)
    )
  };
}

function resolveKnowledgeExplainerVoiceProfile(
  voiceCatalog: TtsCatalog,
  narration: KnowledgeExplainerNarrationPlan
): TtsVoiceProfile {
  const voice = voiceCatalog.voices.find((candidate) => candidate.id === narration.voiceProfileId);
  if (!voice) {
    throw new Error(`KnowledgeExplainer narration voice ${narration.voiceProfileId} is not registered in the voice catalog.`);
  }
  if (voice.language !== narration.language) {
    throw new Error(
      `KnowledgeExplainer narration voice ${voice.id} language=${voice.language} does not match episode language=${narration.language}.`
    );
  }
  return voice;
}

function resolveRegisteredKnowledgeExplainerIllustration(
  card: KnowledgeExplainerCreationPlanCard,
  systemId: string,
  catalog: KnowledgeExplainerIllustrationCatalog
): ResolvedKnowledgeExplainerIllustration {
  const asset = catalog.entries.find((candidate) => candidate.id === card.illustrationAssetId);
  if (!asset) {
    throw new Error(`KnowledgeExplainer card ${card.id} references unknown illustration asset ${card.illustrationAssetId}.`);
  }
  if (asset.status !== "approved") {
    throw new Error(`KnowledgeExplainer card ${card.id} references unapproved illustration asset ${asset.id}.`);
  }
  if (asset.systemId !== systemId) {
    throw new Error(
      `KnowledgeExplainer card ${card.id} illustration asset ${asset.id} belongs to system ${asset.systemId}, expected ${systemId}.`
    );
  }
  return {
    assetId: asset.id,
    assetPath: asset.assetPath,
    systemId: asset.systemId,
    composition: asset.composition
  };
}

function selectKnowledgeExplainerLayout(
  card: KnowledgeExplainerCreationPlanCard,
  viewId: KnowledgeExplainerViewId
): SceneLayoutContract {
  const layout = findLayoutCandidates("illustrated-caption-editorial", viewId, card.role)[0];
  if (!layout) {
    throw new Error(`KnowledgeExplainer theme has no caption layout for card ${card.id} role=${card.role}.`);
  }
  return layout;
}

function createKnowledgeExplainerNarrationSegment(card: KnowledgeExplainerCreationPlanCard, timing: NarrationTimelineRange): NarrationSegment {
  return {
    id: card.id,
    text: card.spokenText,
    caption: card.caption,
    startFrame: timing.startFrame,
    endFrame: timing.endFrame
  };
}

function shiftNarrationTimelineRange(
  timing: NarrationTimelineRange,
  offsetInFrames: number
): NarrationTimelineRange {
  return {
    ...timing,
    startFrame: timing.startFrame + offsetInFrames,
    endFrame: timing.endFrame + offsetInFrames
  };
}

function resolveKnowledgeExplainerFraming(
  plan: KnowledgeExplainerCreationPlan,
  series: KnowledgeExplainerSeriesProfile,
  scenes: KnowledgeExplainerScene[],
  fps: number
): KnowledgeExplainerFraming {
  const firstScene = scenes[0];
  const lastScene = scenes.at(-1);
  if (!firstScene || !lastScene) {
    throw new Error(`KnowledgeExplainer production ${plan.id} requires scenes for theme framing.`);
  }
  const coverTitle = resolveKnowledgeExplainerCoverTitle(plan.episode.title);
  const card = {
    eyebrow: series.displayName,
    ...coverTitle
  };
  const framingDuration = resolveKnowledgeExplainerFramingDuration(fps);
  return {
    ...framingDuration,
    cover: { ...card, illustration: firstScene.illustration },
    closing: { ...card, illustration: lastScene.illustration }
  };
}

function createKnowledgeExplainerIllustrationCues(
  scenes: KnowledgeExplainerScene[]
): KnowledgeExplainerIllustrationCue[] {
  const cues: KnowledgeExplainerIllustrationCue[] = [];
  const completedCueIds = new Set<string>();

  for (const scene of scenes) {
    const cueId = scene.illustrationCueId ?? scene.id;
    const activeCue = cues[cues.length - 1];
    if (activeCue?.id === cueId) {
      if (activeCue.illustration.assetId !== scene.illustration.assetId) {
        throw new Error(
          `KnowledgeExplainer illustration cue ${cueId} cannot switch assets from ${activeCue.illustration.assetId} to ${scene.illustration.assetId}.`
        );
      }
      activeCue.endFrame = scene.endFrame;
      continue;
    }
    if (completedCueIds.has(cueId)) {
      throw new Error(`KnowledgeExplainer illustration cue ${cueId} must be used as one continuous caption group.`);
    }
    if (activeCue) {
      completedCueIds.add(activeCue.id);
    }
    cues.push({
      id: cueId,
      startFrame: scene.startFrame,
      endFrame: scene.endFrame,
      illustration: scene.illustration
    });
  }

  return cues;
}

function resolveMeasuredNarrationDuration(timingMap: NarrationTimingMap): NarrationDuration {
  const seconds = Math.ceil(timingMap.durationMs / 1000);
  return { seconds, source: "measured", warnings: [] };
}

function resolveNarrationTimingSource(
  narrationTimingMap: NarrationTimingMap | undefined,
  preview: boolean
): "measured" | "estimated" | "preview" {
  if (preview) {
    return "preview";
  }
  if (!narrationTimingMap) {
    return "preview";
  }
  return narrationTimingMap.source === "measured-total-duration" ? "estimated" : "measured";
}

/**
 * 将 Skill 已完成决策的制作单编译为不可变生产快照。这里不再检索插画、推断口播或改写字幕。
 */
export function composeKnowledgeExplainerProduction(
  account: KnowledgeExplainerAccountProfile,
  plan: KnowledgeExplainerCreationPlan,
  options: ComposeKnowledgeExplainerProductionOptions
): KnowledgeExplainerProductionComposition {
  if (!options.narrationTimingMap && !options.preview) {
    throw new Error(
      `KnowledgeExplainer production ${plan.id} requires a measured narration timing map. Use preview only for non-publishable layout previews.`
    );
  }

  // 先解析系列绑定的模板与固定品牌框架，再把单集明确选择的资源覆盖写入身份快照。
  const series = resolveKnowledgeExplainerSeries(account, plan);
  const template = getKnowledgeExplainerVideoTemplate(series.templateId);
  assertKnowledgeExplainerCreationPlanCaptionsFit(plan, template.id);
  const knowledgeExplainer = resolveKnowledgeExplainerIdentity(account, series, plan, options.mediaCatalog);
  const view = getKnowledgeExplainerViewProfile(options.viewId ?? series.defaultViewId);

  // 有实测语音时长时它是唯一时间依据；未合成时只生成模板默认时长的不可发布预览。
  const measuredTimeline = options.narrationTimingMap
    ? resolveMeasuredNarrationTimeline(plan.cards, options.narrationTimingMap, view.format.fps)
    : undefined;
  const duration = options.narrationTimingMap
    ? resolveMeasuredNarrationDuration(options.narrationTimingMap)
    : resolveKnowledgeExplainerPreviewDuration();
  const narrationDurationInFrames = measuredTimeline?.durationInFrames ?? duration.seconds * view.format.fps;
  const unframedTimings = measuredTimeline?.ranges ?? allocateNarrationTimeline(
    plan.cards.map((card) => ({ id: card.id, narrationText: card.spokenText })),
    narrationDurationInFrames
  );
  const narrationPlan = resolveKnowledgeExplainerNarrationPlan(account, plan);
  resolveKnowledgeExplainerVoiceProfile(options.voiceCatalog, narrationPlan);
  const seed = options.seed ?? stableSeed(`${account.id}:${series.id}:${plan.id}`);

  const { introDurationInFrames } = resolveKnowledgeExplainerFramingDuration(view.format.fps);
  const scenes: KnowledgeExplainerScene[] = plan.cards.map((card, index) => {
    const unframedTiming = unframedTimings[index];
    const timing = unframedTiming
      ? shiftNarrationTimelineRange(unframedTiming, introDurationInFrames)
      : undefined;
    if (!timing) {
      throw new Error(`Missing calculated timing for knowledge explainer card ${card.id}.`);
    }
    const layout = selectKnowledgeExplainerLayout(card, view.id);
    return {
      id: card.id,
      role: card.role,
      layoutId: layout.id,
      layoutRenderer: layout.renderer,
      startFrame: timing.startFrame,
      endFrame: timing.endFrame,
      eyebrow: series.displayName,
      headline: card.caption,
      illustration: resolveRegisteredKnowledgeExplainerIllustration(card, series.illustrationSystem.id, options.illustrationCatalog),
      illustrationCueId: card.illustrationCueId
    };
  });
  const framing = resolveKnowledgeExplainerFraming(plan, series, scenes, view.format.fps);
  const durationInFrames = narrationDurationInFrames
    + framing.introDurationInFrames
    + framing.outroDurationInFrames;

  const lock = KnowledgeExplainerProductionLockSchema.parse({
    kind: "knowledge-explainer-production",
    id: `${plan.id}-${view.id}`,
    creationMethodId: plan.creationMethodId,
    templateId: plan.templateId,
    title: plan.episode.title,
    episodeId: plan.id,
    knowledgeExplainer,
    themeId: series.themeId,
    seed,
    view,
    format: view.format,
    durationSeconds: Math.ceil(durationInFrames / view.format.fps),
    durationInFrames,
    framing,
    scenes,
    illustrationCues: createKnowledgeExplainerIllustrationCues(scenes),
    narration: {
      audioPath: options.narrationAudioPath,
      timingSource: resolveNarrationTimingSource(options.narrationTimingMap, options.preview === true),
      segments: plan.cards.map((card, index) => {
        const unframedTiming = unframedTimings[index];
        const timing = unframedTiming
          ? shiftNarrationTimelineRange(unframedTiming, framing.introDurationInFrames)
          : undefined;
        if (!timing) {
          throw new Error(`Missing narration timing for knowledge explainer card ${card.id}.`);
        }
        return createKnowledgeExplainerNarrationSegment(card, timing);
      })
    }
  });
  return {
    lock,
    duration
  };
}
