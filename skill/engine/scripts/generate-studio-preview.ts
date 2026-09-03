import { writeFile } from "node:fs/promises";
import {
  KnowledgeExplainerAccountProfileSchema,
  KnowledgeExplainerCreationPlanSchema,
  KnowledgeExplainerIllustrationCatalogSchema,
  KnowledgeExplainerMediaCatalogSchema,
  NarrationTimingMapSchema,
  TtsCatalogSchema
} from "../packages/contracts/src/index";
import { composeKnowledgeExplainerProduction } from "../packages/knowledge-explainer/src/index";

const account = KnowledgeExplainerAccountProfileSchema.parse({
  kind: "knowledge-explainer-account",
  id: "knowledge-demo",
  markText: "学",
  displayName: "开源知识讲解",
  positioningTags: [
    { id: "clear-concept", topLine: "讲清概念", bottomLine: "看见结构" },
    { id: "practical-step", topLine: "拆成步骤", bottomLine: "立即实践" },
    { id: "reliable-source", topLine: "标注依据", bottomLine: "保留边界" }
  ],
  series: [{
    id: "learning-path",
    displayName: "学习路径",
    creationMethodId: "knowledge-explainer",
    templateId: "illustrated-caption",
    themeId: "illustrated-caption-editorial",
    defaultViewId: "portrait-3x4",
    signatureLine: "KNOWLEDGE EXPLAINER",
    disclaimer: "示例内容\n请核验来源",
    footerTagIds: ["clear-concept", "practical-step", "reliable-source"],
    illustrationSystem: {
      id: "knowledge-ink-linework-v1",
      stylePrompt: "现代知识出版物风格线稿插图。",
      canvas: { preferredAspectRatio: 1.6, transparentBackground: true },
      defaultNegativeRules: ["不出现文字、品牌或水印"]
    },
    narration: {
      voiceByLanguage: { zh: "macos-reed-zh" },
      synthesis: { emotion: "calm", speed: 1, volume: 1 }
    },
    backgroundId: "knowledge-warm-paper",
    backgroundMusicId: "none"
  }]
});

const plan = KnowledgeExplainerCreationPlanSchema.parse({
  kind: "knowledge-explainer-plan",
  id: "learning-path-preview",
  creationMethodId: "knowledge-explainer",
  templateId: "illustrated-caption",
  episode: { accountId: "knowledge-demo", seriesId: "learning-path", title: "把目标变成一条路", language: "zh" },
  presentation: { background: { mode: "inherit-series" }, backgroundMusic: { mode: "inherit-series" } },
  narration: {
    voice: { mode: "inherit-series" },
    script: { text: "先看见知识地图，再沿着清晰步骤抵达目标。" }
  },
  cards: [
    {
      id: "map", role: "hook", spokenText: "先看见知识地图，", caption: "先看见知识地图",
      illustrationAssetId: "learning-path", illustrationCueId: "learning-path"
    },
    {
      id: "steps", role: "takeaway", spokenText: "再沿着清晰步骤抵达目标。", caption: "再沿着清晰步骤\n抵达目标",
      illustrationAssetId: "learning-path", illustrationCueId: "learning-path"
    }
  ]
});

const narrationTimingMap = NarrationTimingMapSchema.parse({
  kind: "narration-timing-map",
  source: "local-forced-alignment",
  durationMs: 6000,
  segments: [
    { id: "map", startMs: 0, speechEndMs: 2700, endMs: 3000 },
    { id: "steps", startMs: 3000, speechEndMs: 5700, endMs: 6000 }
  ]
});

const voiceCatalog = TtsCatalogSchema.parse({
  kind: "tts-voice-catalog",
  voices: [{
    id: "macos-reed-zh", provider: "macos-say", displayName: "Reed 本地中文男声",
    providerVoiceId: "Reed (Chinese (China mainland))", gender: "male", language: "zh",
    useCases: ["知识讲解"], tags: ["local"]
  }]
});

const mediaCatalog = KnowledgeExplainerMediaCatalogSchema.parse({
  kind: "knowledge-explainer-media-catalog",
  backgrounds: [{
    id: "knowledge-warm-paper", displayName: "暖白纸", kind: "paper", color: "#FCFAF6",
    paperTextureOpacity: 0.03, description: "轻暖纸张背景"
  }],
  backgroundMusic: [{
    id: "none", displayName: "无背景音乐", status: "active", loop: false, volume: 0,
    description: "仅保留口播", licenseNote: "不需要音乐授权"
  }]
});

const illustrationCatalog = KnowledgeExplainerIllustrationCatalogSchema.parse({
  kind: "knowledge-explainer-illustration-catalog",
  entries: [{
    id: "learning-path", assetPath: "method/illustrations/learning-path.png",
    systemId: "knowledge-ink-linework-v1", subject: "学习者沿着节点走向目标",
    visualMetaphor: "把复杂目标拆成路径", composition: "wide",
    applicationScenarios: ["学习方法"], tags: ["学习", "路径"], status: "approved"
  }]
});

const production = composeKnowledgeExplainerProduction(account, plan, {
  narrationAudioPath: "studio/silence.mp3",
  narrationTimingMap,
  voiceCatalog,
  mediaCatalog,
  illustrationCatalog
}).lock;

await writeFile(new URL("../packages/renderer/src/studio-preview.json", import.meta.url), `${JSON.stringify(production, null, 2)}\n`);
