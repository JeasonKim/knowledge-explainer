import { describe, expect, it } from "vitest";
import type {
  KnowledgeExplainerAccountProfile,
  KnowledgeExplainerIllustrationCatalog,
  KnowledgeExplainerCreationPlan,
  NarrationTimingMap,
  TtsCatalog
} from "@knowledge-explainer/contracts";
import { composeKnowledgeExplainerProduction, resolveKnowledgeExplainerNarrationPlan } from "./compose";

const mediaCatalog = {
  kind: "knowledge-explainer-media-catalog" as const,
  backgrounds: [{
    id: "knowledge-white-paper",
    displayName: "编辑白纸",
    kind: "solid" as const,
    color: "#FFFFFF",
    description: "白色知识出版物背景"
  }, {
    id: "knowledge-warm-paper",
    displayName: "暖白纸",
    kind: "solid" as const,
    color: "#FCFAF6",
    description: "暖白知识出版物背景"
  }],
  backgroundMusic: [{
    id: "none",
    displayName: "无背景音乐",
    status: "active" as const,
    loop: false,
    volume: 0,
    description: "仅保留口播",
    licenseNote: "不需要音乐授权"
  }]
};

const illustrations: KnowledgeExplainerIllustrationCatalog = {
  kind: "knowledge-explainer-illustration-catalog",
  entries: [{
    id: "shifting-connection",
    assetPath: "illustrations/knowledge-explainer/connection.png",
    systemId: "knowledge-ink-linework-v1",
    subject: "两个人之间的距离正在变化",
    visualMetaphor: "关系正在重新划定边界",
    composition: "wide",
    applicationScenarios: ["关系变化"],
    tags: ["关系"],
    status: "approved"
  }, {
    id: "shifting-doorway",
    assetPath: "illustrations/knowledge-explainer/doorway.png",
    systemId: "knowledge-ink-linework-v1",
    subject: "一个人面对变化的门口",
    visualMetaphor: "掌控感正在离开",
    composition: "balanced",
    applicationScenarios: ["职业变化"],
    tags: ["职业"],
    status: "approved"
  }]
};

const voiceCatalog: TtsCatalog = {
  kind: "tts-voice-catalog",
  voices: [{
    id: "cartesia-example-zh",
    provider: "cartesia",
    displayName: "示例中文音色",
    providerVoiceId: "example-voice",
    gender: "unspecified",
    language: "zh",
    useCases: ["知识短视频"],
    tags: []
  }, {
    id: "cartesia-secondary-example-zh",
    provider: "cartesia",
    displayName: "示例男声",
    providerVoiceId: "example-secondary-voice",
    gender: "male",
    language: "zh",
    useCases: ["知识短视频"],
    tags: []
  }]
};

const account: KnowledgeExplainerAccountProfile = {
  kind: "knowledge-explainer-account",
  id: "life-account",
  markText: "知",
  displayName: "@知识实验室",
  positioningTags: [
    { id: "meaning", topLine: "人生意义", bottomLine: "向内求解" },
    { id: "growth", topLine: "成长思考", bottomLine: "持续练习" },
    { id: "choice", topLine: "主动选择", bottomLine: "重建生活" }
  ],
  series: [{
    id: "impermanence",
    displayName: "无常课",
    creationMethodId: "knowledge-explainer",
    themeId: "illustrated-caption-editorial",
    templateId: "illustrated-caption",
    defaultViewId: "portrait-3x4",
    signatureLine: "IMPERMANENCE NOTES",
    disclaimer: "个人观点\n仅供参考",
    footerTagIds: ["meaning", "growth", "choice"],
    narration: {
      voiceByLanguage: { zh: "cartesia-secondary-example-zh" },
      synthesis: { emotion: "calm", speed: 1.15, volume: 1 }
    },
    backgroundId: "knowledge-white-paper",
    backgroundMusicId: "none",
    illustrationSystem: {
      id: "knowledge-ink-linework-v1",
      stylePrompt: "原创黑红线稿插图。",
      canvas: { preferredAspectRatio: 1.6, transparentBackground: true },
      defaultNegativeRules: ["不要文字"]
    }
  }]
};

const plan: KnowledgeExplainerCreationPlan = {
  kind: "knowledge-explainer-plan",
  id: "impermanence-first-minute",
  creationMethodId: "knowledge-explainer",
  templateId: "illustrated-caption",
  episode: {
    accountId: "life-account",
    seriesId: "impermanence",
    title: "怎么和无常共处",
    language: "zh"
  },
  presentation: {
    background: { mode: "override", mediaId: "knowledge-warm-paper" },
    backgroundMusic: { mode: "inherit-series" }
  },
  narration: {
    voice: { mode: "override", voiceProfileId: "cartesia-example-zh" },
    script: { text: "我们害怕的，往往不是失去本身，而是事情不再由自己决定。" }
  },
  cards: [
    {
      id: "hook",
      role: "hook",
      spokenText: "我们害怕的，往往不是失去本身，",
      caption: "我们害怕的\n往往不是失去本身",
      illustrationAssetId: "shifting-connection",
      illustrationCueId: "hook"
    },
    {
      id: "claim",
      role: "claim",
      spokenText: "而是事情不再由自己决定。",
      caption: "而是事情\n不再由自己决定",
      illustrationAssetId: "shifting-doorway",
      illustrationCueId: "claim"
    }
  ]
};

const compositionOptions = {
  narrationAudioPath: "audio/impermanence.wav",
  voiceCatalog,
  mediaCatalog,
  illustrationCatalog: illustrations,
  preview: true
};

describe("composeKnowledgeExplainerProduction", () => {
  it("正式编译没有实测 timing map 时拒绝使用字符数估算", () => {
    const { preview: _preview, ...releaseOptions } = compositionOptions;

    expect(() => composeKnowledgeExplainerProduction(account, plan, releaseOptions))
      .toThrow("requires a measured narration timing map");
  });

  it("只解析 Skill 已选择的资源与口播参数，不再检索插图或推断情绪", () => {
    const result = composeKnowledgeExplainerProduction(account, plan, { ...compositionOptions, seed: 9 });

    expect(result.lock).toMatchObject({
      themeId: "illustrated-caption-editorial",
      durationSeconds: 62,
      durationInFrames: 1482,
      format: { width: 1080, height: 1440, fps: 24 },
      knowledgeExplainer: {
        accountName: "@知识实验室",
        seriesName: "无常课",
        narration: { voiceProfileId: "cartesia-example-zh" },
        background: { id: "knowledge-warm-paper" },
        backgroundMusic: { id: "none" }
      }
    });
    expect(result.lock).not.toHaveProperty("releasePacing");
    expect(result.lock.scenes[0]?.illustration).toEqual({
      assetId: "shifting-connection",
      assetPath: "illustrations/knowledge-explainer/connection.png",
      systemId: "knowledge-ink-linework-v1",
      composition: "wide"
    });
    expect(result.lock.narration.segments[0]).toMatchObject({
      text: "我们害怕的，往往不是失去本身，",
      caption: "我们害怕的\n往往不是失去本身"
    });
    expect(result.lock.scenes[0]?.headline).toBe("我们害怕的\n往往不是失去本身");
    expect(result.lock.narration.timingSource).toBe("preview");
  });

  it("允许单集覆盖系列音色，并在未覆盖时使用系列默认音色", () => {
    expect(resolveKnowledgeExplainerNarrationPlan(account, plan)).toMatchObject({ voiceProfileId: "cartesia-example-zh" });
    expect(resolveKnowledgeExplainerNarrationPlan(account, {
      ...plan,
      narration: { ...plan.narration, voice: { mode: "inherit-series" } }
    })).toMatchObject({ voiceProfileId: "cartesia-secondary-example-zh" });
  });

  it("允许多张连续字幕复用同一提示组插图", () => {
    const sharedIllustrationPlan: KnowledgeExplainerCreationPlan = {
      ...plan,
      cards: [{
        ...plan.cards[0]!,
        illustrationCueId: "same-idea",
        illustrationAssetId: "shifting-connection"
      }, {
        ...plan.cards[1]!,
        illustrationCueId: "same-idea",
        illustrationAssetId: "shifting-connection"
      }]
    };

    const result = composeKnowledgeExplainerProduction(account, sharedIllustrationPlan, compositionOptions);

    expect(result.lock.illustrationCues).toEqual([{
      id: "same-idea",
      startFrame: 12,
      endFrame: 1452,
      illustration: {
        assetId: "shifting-connection",
        assetPath: "illustrations/knowledge-explainer/connection.png",
        systemId: "knowledge-ink-linework-v1",
        composition: "wide"
      }
    }]);
  });

  it("拒绝在中间插入其他插图后复用已结束的提示组", () => {
    const nonContiguousCuePlan: KnowledgeExplainerCreationPlan = {
      ...plan,
      cards: [{
        ...plan.cards[0]!,
        illustrationCueId: "shared-idea",
        illustrationAssetId: "shifting-connection"
      }, {
        ...plan.cards[1]!,
        illustrationCueId: "other-idea",
        illustrationAssetId: "shifting-doorway"
      }, {
        ...plan.cards[0]!,
        id: "hook-repeat",
        illustrationCueId: "shared-idea",
        illustrationAssetId: "shifting-connection"
      }]
    };

    expect(() => composeKnowledgeExplainerProduction(account, nonContiguousCuePlan, compositionOptions))
      .toThrow("must be used as one continuous caption group");
  });

  it("拒绝未审核插图与错误视觉系统，避免工程替换素材", () => {
    expect(() => composeKnowledgeExplainerProduction(account, {
      ...plan,
      cards: [{ ...plan.cards[0]!, illustrationAssetId: "missing" }]
    }, compositionOptions)).toThrow("unknown illustration asset");

    const wrongSystemCatalog: KnowledgeExplainerIllustrationCatalog = {
      ...illustrations,
      entries: [{ ...illustrations.entries[0]!, systemId: "another-system" }, illustrations.entries[1]!]
    };
    expect(() => composeKnowledgeExplainerProduction(account, plan, {
      ...compositionOptions,
      illustrationCatalog: wrongSystemCatalog
    })).toThrow("belongs to system");
  });

  it("使用实测语音时间轴作为未经后期倍速调整的唯一成片时间线", () => {
    const timingMap: NarrationTimingMap = {
      kind: "narration-timing-map",
      source: "local-forced-alignment",
      durationMs: 2500,
      segments: [
        { id: "hook", startMs: 0, speechEndMs: 800, endMs: 1100 },
        { id: "claim", startMs: 1100, speechEndMs: 2400, endMs: 2500 }
      ]
    };

    const result = composeKnowledgeExplainerProduction(account, plan, {
      ...compositionOptions,
      narrationTimingMap: timingMap,
      preview: false
    });

    expect(result.duration).toMatchObject({ seconds: 3, source: "measured" });
    expect(result.duration.warnings).toEqual([]);
    expect(result.lock.framing).toMatchObject({
      introDurationInFrames: 12,
      outroDurationInFrames: 30,
      cover: {
        primaryTitle: "怎么和无",
        emphasisTitle: "常共处",
        illustration: { assetId: "shifting-connection" }
      },
      closing: {
        primaryTitle: "怎么和无",
        emphasisTitle: "常共处",
        illustration: { assetId: "shifting-doorway" }
      }
    });
    expect(result.lock.durationInFrames).toBe(102);
    expect(result.lock.durationSeconds).toBe(5);
    expect(result.lock.scenes[0]).toMatchObject({ startFrame: 12 });
    expect(result.lock.scenes.at(-1)).toMatchObject({ endFrame: 72 });
    expect(result.lock.narration.segments[0]).toMatchObject({ startFrame: 12 });
    expect(result.lock.narration.segments.at(-1)).toMatchObject({ endFrame: 72 });
    expect(result.lock).not.toHaveProperty("releasePacing");
  });

  it("切换输出视图时复用同一份脚本、插图和实测时间轴", () => {
    const timingMap: NarrationTimingMap = {
      kind: "narration-timing-map",
      source: "local-forced-alignment",
      durationMs: 2500,
      segments: [
        { id: "hook", startMs: 0, speechEndMs: 800, endMs: 1100 },
        { id: "claim", startMs: 1100, speechEndMs: 2400, endMs: 2500 }
      ]
    };
    const portrait = composeKnowledgeExplainerProduction(account, plan, {
      ...compositionOptions,
      narrationTimingMap: timingMap,
      viewId: "portrait-3x4"
    });
    const landscape = composeKnowledgeExplainerProduction(account, plan, {
      ...compositionOptions,
      narrationTimingMap: timingMap,
      viewId: "landscape-16x9"
    });

    expect(portrait.lock.durationSeconds).toBe(landscape.lock.durationSeconds);
    expect(portrait.lock.narration.segments).toEqual(landscape.lock.narration.segments);
    expect(portrait.lock.scenes.map((scene) => scene.illustration.assetId))
      .toEqual(landscape.lock.scenes.map((scene) => scene.illustration.assetId));
    expect(landscape.lock).toMatchObject({
      view: { id: "landscape-16x9" },
      format: { width: 1920, height: 1080, fps: 24 }
    });
  });

  it("整条音频时长暂定分配的卡片时间会明确标记为 estimated", () => {
    const timingMap: NarrationTimingMap = {
      kind: "narration-timing-map",
      source: "measured-total-duration",
      durationMs: 2500,
      segments: [
        { id: "hook", startMs: 0, speechEndMs: 1100, endMs: 1100 },
        { id: "claim", startMs: 1100, speechEndMs: 2500, endMs: 2500 }
      ]
    };

    const result = composeKnowledgeExplainerProduction(account, plan, {
      ...compositionOptions,
      narrationTimingMap: timingMap,
      preview: false
    });

    expect(result.lock.narration.timingSource).toBe("estimated");
  });
});
