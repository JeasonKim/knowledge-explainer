import { z } from "zod";

export const CreationMethodIdSchema = z.literal("knowledge-explainer");

export const KnowledgeExplainerAccountKindSchema = z.literal("knowledge-explainer-account");

export const SubjectAssetDerivativeSchema = z.object({
  creationMethodId: CreationMethodIdSchema,
  assetPath: z.string().trim().min(1).max(500)
}).strict().superRefine((derivative, context) => {
  const methodAssetPrefix = "method/";
  if (!derivative.assetPath.startsWith(methodAssetPrefix)) {
    context.addIssue({
      code: "custom",
      path: ["assetPath"],
      message: `subject derivative must stay in its creation method asset directory ${methodAssetPrefix}`
    });
  }
});

export const SubjectAssetSchema = z.object({
  id: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().trim().min(1).max(120),
  identityDescription: z.string().trim().min(1).max(500),
  canonicalAssetPath: z.string().trim().min(1).max(500),
  allowedCreationMethods: z.array(CreationMethodIdSchema).length(1),
  derivatives: z.array(SubjectAssetDerivativeSchema).max(24).default([])
}).strict().superRefine((subject, context) => {
  const canonicalAssetPrefix = `shared/subjects/${subject.id}/`;
  if (!subject.canonicalAssetPath.startsWith(canonicalAssetPrefix)) {
    context.addIssue({
      code: "custom",
      path: ["canonicalAssetPath"],
      message: `subject canonical asset must stay in ${canonicalAssetPrefix}`
    });
  }
  const allowedMethods = new Set(subject.allowedCreationMethods);
  const knownMethods = new Set<string>();
  for (const [index, derivative] of subject.derivatives.entries()) {
    if (!allowedMethods.has(derivative.creationMethodId)) {
      context.addIssue({
        code: "custom",
        path: ["derivatives", index, "creationMethodId"],
        message: `subject derivative method ${derivative.creationMethodId} is not allowed for subject ${subject.id}`
      });
    }
    const derivativeKey = `${derivative.creationMethodId}:${derivative.assetPath}`;
    if (knownMethods.has(derivativeKey)) {
      context.addIssue({
        code: "custom",
        path: ["derivatives", index, "assetPath"],
        message: `duplicate subject derivative ${derivativeKey}`
      });
    }
    knownMethods.add(derivativeKey);
  }
});

export const SubjectAssetCatalogSchema = z.object({
  kind: z.literal("knowledge-explainer-subject-catalog"),
  subjects: z.array(SubjectAssetSchema).default([])
}).strict().superRefine((catalog, context) => {
  const subjectIds = new Set<string>();
  for (const [index, subject] of catalog.subjects.entries()) {
    if (subjectIds.has(subject.id)) {
      context.addIssue({
        code: "custom",
        path: ["subjects", index, "id"],
        message: `duplicate subject id ${subject.id}`
      });
    }
    subjectIds.add(subject.id);
  }
});

export const KnowledgeExplainerCreationMethodIdSchema = z.literal("knowledge-explainer");

export const KnowledgeExplainerTemplateIdSchema = z.literal("illustrated-caption");

export const CanvasFormatSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive()
});

/**
 * 模板契约既是调试器保存的唯一事实源，也是引擎验证内容与视觉绑定的依据。
 * 创作计划只提供字段值；槽位、几何、字体和样式全部保留在这里。
 */
export const TemplateDesignFieldIdSchema = z.string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/);

export const TemplateDesignFieldScopeSchema = z.enum(["static", "scene"]);

export const TemplateDesignFieldValueTypeSchema = z.enum(["text", "rich-text", "image"]);

export const TemplateDesignDataFieldSchema = z.object({
  id: TemplateDesignFieldIdSchema,
  displayName: z.string().trim().min(1).max(80),
  valueType: TemplateDesignFieldValueTypeSchema,
  scope: TemplateDesignFieldScopeSchema,
  required: z.boolean(),
  sourcePath: z.string().trim().min(1).max(240),
  sampleValue: z.string().min(1).max(1_200),
  constraints: z.object({
    maxCharacters: z.number().int().positive().max(2_000).optional(),
    maxItems: z.number().int().positive().max(240).optional(),
    allowedValues: z.array(z.string().trim().min(1).max(120)).min(1).max(30).optional()
  }).strict().optional()
}).strict().superRefine((field, context) => {
  const allowedValues = field.constraints?.allowedValues;
  if (!allowedValues) {
    return;
  }
  if (new Set(allowedValues).size !== allowedValues.length) {
    context.addIssue({
      code: "custom",
      path: ["constraints", "allowedValues"],
      message: "template field allowedValues cannot contain duplicates"
    });
  }
  if (!allowedValues.includes(field.sampleValue)) {
    context.addIssue({
      code: "custom",
      path: ["sampleValue"],
      message: "template field sampleValue must be one of constraints.allowedValues"
    });
  }
});

export const TemplateDesignRectSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive()
}).strict();

export const TemplateDesignTextStyleSchema = z.object({
  fontFamily: z.string().trim().min(1).max(500),
  fontSize: z.number().positive(),
  fontWeight: z.number().int().min(100).max(1_000),
  lineHeight: z.number().positive().max(4),
  letterSpacing: z.number().min(-100).max(100),
  textAlign: z.enum(["left", "center", "right"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  maxLines: z.number().int().positive().max(24),
  strokeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  strokeWidth: z.number().nonnegative().max(100).optional(),
  shadow: z.object({
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    opacity: z.number().min(0).max(1),
    offsetX: z.number().min(-1_000).max(1_000),
    offsetY: z.number().min(-1_000).max(1_000),
    blur: z.number().nonnegative().max(1_000)
  }).strict().optional()
}).strict();

export const TemplateDesignImageStyleSchema = z.object({
  objectFit: z.enum(["contain", "cover", "fill"]),
  borderRadius: z.number().nonnegative().max(10_000).default(0)
}).strict();

export const TemplateDesignSurfaceStyleSchema = z.object({
  fill: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  borderColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  borderWidth: z.number().nonnegative().max(100).optional(),
  borderRadius: z.number().nonnegative().max(10_000).optional(),
  opacity: z.number().min(0).max(1).optional()
}).strict();

export const TemplateDesignLayerKindSchema = z.enum(["text", "image", "shape", "anchor"]);

export const TemplateDesignLayerSchema = z.object({
  id: z.string().trim().min(1).max(120).regex(/^[a-z][a-z0-9-]*$/),
  displayName: z.string().trim().min(1).max(80),
  kind: TemplateDesignLayerKindSchema,
  scope: TemplateDesignFieldScopeSchema,
  fieldId: TemplateDesignFieldIdSchema.optional(),
  zIndex: z.number().int().nonnegative().max(10_000),
  rect: TemplateDesignRectSchema,
  text: TemplateDesignTextStyleSchema.optional(),
  image: TemplateDesignImageStyleSchema.optional(),
  surface: TemplateDesignSurfaceStyleSchema.optional()
}).strict().superRefine((layer, context) => {
  if (layer.kind === "text" && !layer.text) {
    context.addIssue({ code: "custom", path: ["text"], message: "text layer requires a text style" });
  }
  if (layer.kind === "image" && !layer.image) {
    context.addIssue({ code: "custom", path: ["image"], message: "image layer requires an image style" });
  }
  if ((layer.kind === "text" || layer.kind === "image") && !layer.fieldId) {
    context.addIssue({ code: "custom", path: ["fieldId"], message: `${layer.kind} layer requires a field binding` });
  }
});

export const TemplateDesignSafeAreaSchema = z.object({
  top: z.number().nonnegative(),
  right: z.number().nonnegative(),
  bottom: z.number().nonnegative(),
  left: z.number().nonnegative()
}).strict();

export const TemplateDesignViewSchema = z.object({
  id: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().trim().min(1).max(120),
  canvas: CanvasFormatSchema,
  safeArea: TemplateDesignSafeAreaSchema,
  layers: z.array(TemplateDesignLayerSchema).min(1).max(160)
}).strict();

export const VideoTemplateDesignSchema = z.object({
  kind: z.literal("video-template-design"),
  id: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  creationMethodId: CreationMethodIdSchema,
  displayName: z.string().trim().min(1).max(120),
  fields: z.array(TemplateDesignDataFieldSchema).min(1).max(120),
  views: z.array(TemplateDesignViewSchema).min(1).max(12)
}).strict().superRefine((template, context) => {
  const fieldIds = new Set<string>();
  for (const [fieldIndex, field] of template.fields.entries()) {
    if (fieldIds.has(field.id)) {
      context.addIssue({ code: "custom", path: ["fields", fieldIndex, "id"], message: `duplicate field id ${field.id}` });
    }
    fieldIds.add(field.id);
  }

  const viewIds = new Set<string>();
  for (const [viewIndex, view] of template.views.entries()) {
    if (viewIds.has(view.id)) {
      context.addIssue({ code: "custom", path: ["views", viewIndex, "id"], message: `duplicate view id ${view.id}` });
    }
    viewIds.add(view.id);
    if (view.safeArea.left + view.safeArea.right >= view.canvas.width
      || view.safeArea.top + view.safeArea.bottom >= view.canvas.height) {
      context.addIssue({ code: "custom", path: ["views", viewIndex, "safeArea"], message: "safe area leaves no usable template canvas" });
    }

    const layerIds = new Set<string>();
    for (const [layerIndex, layer] of view.layers.entries()) {
      if (layerIds.has(layer.id)) {
        context.addIssue({ code: "custom", path: ["views", viewIndex, "layers", layerIndex, "id"], message: `duplicate layer id ${layer.id}` });
      }
      layerIds.add(layer.id);
      if (layer.rect.x + layer.rect.width > view.canvas.width
        || layer.rect.y + layer.rect.height > view.canvas.height) {
        context.addIssue({ code: "custom", path: ["views", viewIndex, "layers", layerIndex, "rect"], message: `layer ${layer.id} exceeds the template canvas` });
      }
      if (!layer.fieldId) {
        continue;
      }
      const field = template.fields.find((candidate) => candidate.id === layer.fieldId);
      if (!field) {
        context.addIssue({ code: "custom", path: ["views", viewIndex, "layers", layerIndex, "fieldId"], message: `layer ${layer.id} binds unknown field ${layer.fieldId}` });
        continue;
      }
      if (field.scope !== layer.scope) {
        context.addIssue({ code: "custom", path: ["views", viewIndex, "layers", layerIndex, "scope"], message: `layer ${layer.id} scope does not match field scope` });
      }
      if (layer.kind === "text" && field.valueType === "image") {
        context.addIssue({ code: "custom", path: ["views", viewIndex, "layers", layerIndex, "fieldId"], message: `text layer ${layer.id} cannot bind image field ${field.id}` });
      }
      if (layer.kind === "image" && field.valueType !== "image") {
        context.addIssue({ code: "custom", path: ["views", viewIndex, "layers", layerIndex, "fieldId"], message: `image layer ${layer.id} requires an image field` });
      }
    }
  }
});

export const NarrationEmotionSchema = z.enum([
  "neutral",
  "calm",
  "content",
  "sad",
  "sympathetic",
  "contemplative",
  "confident",
  "determined"
]);

export const NarrationDirectionSchema = z.object({
  // `intent` 只供脚本审阅；实际支持的控制项由 TTS 网关按供应商能力映射。
  intent: z.string().trim().min(1).max(120).regex(/^[^\[\]]+$/).optional(),
  emotion: NarrationEmotionSchema.optional(),
  speed: z.number().min(0.6).max(1.5).optional(),
  volume: z.number().min(0.5).max(2).optional()
});

export const NarrationSegmentSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  caption: z.string().min(1),
  direction: NarrationDirectionSchema.optional(),
  startFrame: z.number().int().nonnegative(),
  speechEndFrame: z.number().int().positive().optional(),
  endFrame: z.number().int().positive()
}).superRefine((segment, context) => {
  if (segment.speechEndFrame !== undefined && (
    segment.speechEndFrame < segment.startFrame
    || segment.speechEndFrame > segment.endFrame
  )) {
    context.addIssue({
      code: "custom",
      path: ["speechEndFrame"],
      message: "speechEndFrame must stay within the narration segment"
    });
  }
});

export const NarrationTimingSourceSchema = z.enum(["measured", "estimated", "preview"]);

export const NarrationSchema = z.object({
  audioPath: z.string().min(1),
  timingSource: NarrationTimingSourceSchema.default("preview"),
  segments: z.array(NarrationSegmentSchema).min(1)
});

export const NarrationTimingMapSegmentSchema = z.object({
  id: z.string().min(1),
  startMs: z.number().int().nonnegative(),
  speechEndMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive()
}).superRefine((segment, context) => {
  if (segment.startMs > segment.speechEndMs) {
    context.addIssue({
      code: "custom",
      path: ["speechEndMs"],
      message: "speechEndMs must be greater than or equal to startMs"
    });
  }
  if (segment.speechEndMs > segment.endMs) {
    context.addIssue({
      code: "custom",
      path: ["endMs"],
      message: "endMs must be greater than or equal to speechEndMs"
    });
  }
});

export const NarrationTimingMapSchema = z.object({
  kind: z.literal("narration-timing-map"),
  source: z.enum([
    "measured-total-duration",
    "provider-timestamps",
    "local-forced-alignment"
  ]),
  durationMs: z.number().int().positive(),
  segments: z.array(NarrationTimingMapSegmentSchema).min(1)
}).strict().superRefine((timingMap, context) => {
  const knownIds = new Set<string>();
  let expectedStartMs = 0;

  for (const [index, segment] of timingMap.segments.entries()) {
    if (knownIds.has(segment.id)) {
      context.addIssue({
        code: "custom",
        path: ["segments", index, "id"],
        message: `duplicate narration timing segment id ${segment.id}`
      });
    }
    knownIds.add(segment.id);
    if (segment.startMs !== expectedStartMs) {
      context.addIssue({
        code: "custom",
        path: ["segments", index, "startMs"],
        message: `segment ${segment.id} must start at ${expectedStartMs}ms to preserve a continuous visual timeline`
      });
    }
    expectedStartMs = segment.endMs;
  }

  if (expectedStartMs !== timingMap.durationMs) {
    context.addIssue({
      code: "custom",
      path: ["durationMs"],
      message: `durationMs must equal the final segment endMs ${expectedStartMs}`
    });
  }
});

export const TtsProviderIdSchema = z.enum(["cartesia", "volcengine", "macos-say"]);

export const TtsVoiceGenderSchema = z.enum(["male", "female", "unspecified"]);

export const TtsVoiceLanguageSchema = z.enum(["zh", "en"]);

export const TtsVoiceProfileSchema = z.object({
  id: z.string().trim().min(1).max(120),
  provider: TtsProviderIdSchema,
  displayName: z.string().trim().min(1).max(120),
  providerVoiceId: z.string().trim().min(1).max(200),
  gender: TtsVoiceGenderSchema,
  language: TtsVoiceLanguageSchema,
  useCases: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
  description: z.string().trim().min(1).max(240).optional(),
  tags: z.array(z.string().trim().min(1).max(48)).max(12).default([])
});

export const TtsCatalogSchema = z.object({
  kind: z.literal("tts-voice-catalog"),
  voices: z.array(TtsVoiceProfileSchema).min(1)
}).superRefine((catalog, context) => {
  const voiceIds = new Set<string>();
  for (const [voiceIndex, voice] of catalog.voices.entries()) {
    if (voiceIds.has(voice.id)) {
      context.addIssue({
        code: "custom",
        path: ["voices", voiceIndex, "id"],
        message: `duplicate TTS voice id ${voice.id}`
      });
    }
    voiceIds.add(voice.id);
  }
});

export const NarrationSynthesisSettingsSchema = z.object({
  emotion: NarrationEmotionSchema.default("neutral"),
  speed: z.number().min(0.6).max(1.5).default(1),
  volume: z.number().min(0.5).max(2).default(1)
});

// Cartesia 当前完整支持该组控制字段；其他供应商只消费自己有等价能力的字段。
export const CartesiaSynthesisSettingsSchema = NarrationSynthesisSettingsSchema;

export const CartesiaConfigSchema = z.object({
  kind: z.literal("cartesia-config"),
  modelId: z.string().trim().min(1).max(120),
  apiVersion: z.string().trim().min(1).max(40),
  synthesis: CartesiaSynthesisSettingsSchema
});

export const VolcengineTtsAudioConfigSchema = z.object({
  format: z.enum(["mp3", "wav"]),
  sampleRate: z.number().int().min(8000).max(48000)
});

export const VolcengineTtsConfigSchema = z.object({
  kind: z.literal("volcengine-tts-config"),
  endpoint: z.url(),
  resourceId: z.string().trim().min(1).max(120),
  audio: VolcengineTtsAudioConfigSchema,
  explicitLanguage: z.string().trim().min(1).max(24).optional(),
  voiceInstruction: z.string().trim().min(1).max(400).optional()
});

export const CartesiaPronunciationNotationSchema = z.enum([
  "sounds-like",
  "ipa",
  "spell"
]);

export const CartesiaPronunciationMatchModeSchema = z.enum([
  "exact",
  "case-insensitive"
]);

export const CartesiaPronunciationEntrySchema = z.object({
  id: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(160),
  language: TtsVoiceLanguageSchema,
  notation: CartesiaPronunciationNotationSchema,
  pronunciation: z.string().trim().min(1).max(240).optional(),
  matchMode: CartesiaPronunciationMatchModeSchema.default("exact"),
  applicationScenarios: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  note: z.string().trim().min(1).max(240).optional(),
  status: z.enum(["active", "disabled"]).default("active")
}).superRefine((entry, context) => {
  if (entry.notation === "spell" && entry.pronunciation) {
    context.addIssue({
      code: "custom",
      path: ["pronunciation"],
      message: "spell entries use the original text inside Cartesia <spell> and cannot define pronunciation"
    });
  }
  if (entry.notation !== "spell" && !entry.pronunciation) {
    context.addIssue({
      code: "custom",
      path: ["pronunciation"],
      message: "sounds-like and ipa entries require a Cartesia pronunciation alias"
    });
  }
  if (entry.notation === "ipa" && entry.pronunciation && !/^<<.+>>$/.test(entry.pronunciation)) {
    context.addIssue({
      code: "custom",
      path: ["pronunciation"],
      message: "ipa pronunciation must use Cartesia's <<phone|phone>> notation"
    });
  }
  if (entry.language !== "en" && entry.matchMode === "case-insensitive") {
    context.addIssue({
      code: "custom",
      path: ["matchMode"],
      message: "case-insensitive matching is only supported for English corrections"
    });
  }
});

export const CartesiaPronunciationCatalogSchema = z.object({
  kind: z.literal("cartesia-pronunciation-catalog"),
  dictionary: z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(240),
    remoteId: z.string().trim().min(1).max(200).optional()
  }),
  entries: z.array(CartesiaPronunciationEntrySchema).default([])
}).superRefine((catalog, context) => {
  const ids = new Set<string>();
  const remoteKeys = new Set<string>();
  for (const [index, entry] of catalog.entries.entries()) {
    if (ids.has(entry.id)) {
      context.addIssue({ code: "custom", path: ["entries", index, "id"], message: `duplicate pronunciation id ${entry.id}` });
    }
    ids.add(entry.id);
    const remoteKey = entry.text.toLocaleLowerCase("en-US");
    if (entry.status === "active" && entry.notation !== "spell" && remoteKeys.has(remoteKey)) {
      context.addIssue({ code: "custom", path: ["entries", index, "text"], message: `duplicate active Cartesia dictionary text ${entry.text}` });
    }
    if (entry.status === "active" && entry.notation !== "spell") {
      remoteKeys.add(remoteKey);
    }
  }
});

export const StoryBeatRoleSchema = z.enum([
  "hook",
  "claim",
  "contrast",
  "example",
  "framework",
  "takeaway",
  "end-card"
]);

export const KnowledgeExplainerPositioningTagSchema = z.object({
  id: z.string().min(1),
  topLine: z.string().min(1),
  bottomLine: z.string().min(1)
});

const KnowledgeExplainerTwoLineDisclaimerSchema = z.string().trim().superRefine((value, context) => {
  const lines = value.split(/\r?\n/).map((line) => line.trim());
  if (lines.length !== 2) {
    context.addIssue({ code: "custom", message: "knowledge explainer disclaimer must contain exactly two display lines" });
    return;
  }
  for (const [index, line] of lines.entries()) {
    const characterCount = Array.from(line).length;
    if (characterCount === 0 || characterCount > 8) {
      context.addIssue({
        code: "custom",
        path: [index],
        message: "knowledge explainer disclaimer lines must contain from 1 to 8 characters"
      });
    }
  }
});

export const KnowledgeExplainerIllustrationCanvasSchema = z.object({
  preferredAspectRatio: z.number().min(1).max(2.5),
  transparentBackground: z.literal(true)
});

export const KnowledgeExplainerIllustrationCompositionSchema = z.enum(["wide", "balanced", "tall"]);

export const KnowledgeExplainerIllustrationSheetOriginSchema = z.object({
  batchId: z.string().trim().min(1).max(120),
  sourceAssetPath: z.string().trim().min(1),
  grid: z.object({
    row: z.number().int().nonnegative(),
    column: z.number().int().nonnegative()
  })
});

export const KnowledgeExplainerIllustrationSystemSchema = z.object({
  id: z.string().min(1),
  stylePrompt: z.string().min(1),
  canvas: KnowledgeExplainerIllustrationCanvasSchema,
  defaultNegativeRules: z.array(z.string().min(1)).min(1)
});

export const KnowledgeExplainerIllustrationCatalogEntrySchema = z.object({
  id: z.string().trim().min(1).max(120),
  assetPath: z.string().trim().min(1),
  systemId: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(240),
  visualMetaphor: z.string().trim().min(1).max(240),
  composition: KnowledgeExplainerIllustrationCompositionSchema,
  applicationScenarios: z.array(z.string().trim().min(1).max(160)).min(1).max(12),
  tags: z.array(z.string().trim().min(1).max(60)).min(1).max(16),
  status: z.enum(["approved", "archived"]).default("approved"),
  sheetOrigin: KnowledgeExplainerIllustrationSheetOriginSchema.optional()
});

export const KnowledgeExplainerIllustrationCatalogSchema = z.object({
  kind: z.literal("knowledge-explainer-illustration-catalog"),
  entries: z.array(KnowledgeExplainerIllustrationCatalogEntrySchema).default([])
}).superRefine((catalog, context) => {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const [index, entry] of catalog.entries.entries()) {
    if (ids.has(entry.id)) {
      context.addIssue({ code: "custom", path: ["entries", index, "id"], message: `duplicate illustration id ${entry.id}` });
    }
    ids.add(entry.id);
    if (paths.has(entry.assetPath)) {
      context.addIssue({ code: "custom", path: ["entries", index, "assetPath"], message: `duplicate illustration asset path ${entry.assetPath}` });
    }
    paths.add(entry.assetPath);
  }
});

export const KnowledgeExplainerBackgroundSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  kind: z.enum(["solid", "paper"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  paperTextureOpacity: z.number().min(0).max(0.16).optional(),
  description: z.string().min(1).max(240)
}).superRefine((background, context) => {
  if (!background.color) {
    context.addIssue({ code: "custom", path: ["color"], message: "background color is required" });
  }
  if (background.kind === "paper" && background.paperTextureOpacity === undefined) {
    context.addIssue({ code: "custom", path: ["paperTextureOpacity"], message: "paper backgrounds require paperTextureOpacity" });
  }
});

export const KnowledgeExplainerBackgroundMusicSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  assetPath: z.string().min(1).optional(),
  status: z.enum(["active", "pending"]).default("active"),
  loop: z.boolean().default(true),
  volume: z.number().min(0).max(1).default(0.1),
  description: z.string().min(1).max(240),
  licenseNote: z.string().min(1).max(240)
}).superRefine((music, context) => {
  if (music.id === "none" && music.assetPath) {
    context.addIssue({ code: "custom", path: ["assetPath"], message: "music id=none cannot have an asset path" });
  }
  if (music.id !== "none" && !music.assetPath) {
    context.addIssue({ code: "custom", path: ["assetPath"], message: "background music requires an asset path" });
  }
  if (music.status === "active" && music.id !== "none" && !music.assetPath) {
    context.addIssue({ code: "custom", path: ["assetPath"], message: "active background music requires an asset path" });
  }
});

export const KnowledgeExplainerMediaCatalogSchema = z.object({
  kind: z.literal("knowledge-explainer-media-catalog"),
  backgrounds: z.array(KnowledgeExplainerBackgroundSchema).min(1),
  backgroundMusic: z.array(KnowledgeExplainerBackgroundMusicSchema).min(1)
}).superRefine((catalog, context) => {
  for (const [key, entries] of Object.entries({ backgrounds: catalog.backgrounds, backgroundMusic: catalog.backgroundMusic })) {
    const ids = new Set<string>();
    for (const [index, entry] of entries.entries()) {
      if (ids.has(entry.id)) {
        context.addIssue({ code: "custom", path: [key, index, "id"], message: `duplicate ${key} id ${entry.id}` });
      }
      ids.add(entry.id);
    }
  }
});

export const ResolvedKnowledgeExplainerIllustrationSchema = z.object({
  assetId: z.string().trim().min(1).max(120),
  assetPath: z.string().trim().min(1),
  systemId: z.string().min(1),
  composition: KnowledgeExplainerIllustrationCompositionSchema
});

export const KnowledgeExplainerViewIdSchema = z.enum([
  "portrait-3x4",
  "vertical-9x16",
  "landscape-16x9"
]);

export const KnowledgeExplainerTemplateRectSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().positive(),
  height: z.number().positive()
});

export const KnowledgeExplainerTemplateColorTokenSchema = z.enum([
  "canvas",
  "ink",
  "mutedInk",
  "accent",
  "rule"
]);

export const KnowledgeExplainerTemplateColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const KnowledgeExplainerTemplateTextStyleSchema = z.object({
  fontFamily: z.string().min(1),
  fontSize: z.number().positive(),
  fontWeight: z.number().int().min(100).max(1000),
  lineHeight: z.number().positive(),
  letterSpacing: z.number(),
  textAlign: z.enum(["left", "center", "right"]),
  whiteSpace: z.enum(["nowrap", "pre", "pre-line"]),
  colorToken: KnowledgeExplainerTemplateColorTokenSchema.default("ink")
});

export const KnowledgeExplainerCaptionBreakPrioritySchema = z.enum([
  "sentence",
  "punctuation",
  "character"
]);

export const KnowledgeExplainerCaptionMetricSchema = z.object({
  cjkAdvance: z.number().positive(),
  latinAdvance: z.number().positive(),
  punctuationAdvance: z.number().positive(),
  whitespaceAdvance: z.number().positive()
});

export const KnowledgeExplainerTemplateTextFittingSchema = z.object({
  maxLines: z.number().int().positive(),
  overflow: z.enum(["reject", "split-scene"]),
  breakPriority: z.array(KnowledgeExplainerCaptionBreakPrioritySchema).min(1),
  metrics: KnowledgeExplainerCaptionMetricSchema
});

export const KnowledgeExplainerTemplateModuleKindSchema = z.enum([
  "account-mark",
  "account-name",
  "episode-title",
  "caption",
  "signature",
  "illustration",
  "disclaimer",
  "footer"
]);

export const KnowledgeExplainerTemplateModuleSchema = z.object({
  id: z.string().min(1),
  kind: KnowledgeExplainerTemplateModuleKindSchema,
  scope: z.enum(["static", "scene"]),
  zIndex: z.number().int().nonnegative().default(0),
  rect: KnowledgeExplainerTemplateRectSchema,
  text: KnowledgeExplainerTemplateTextStyleSchema.optional(),
  fitting: KnowledgeExplainerTemplateTextFittingSchema.optional(),
  color: KnowledgeExplainerTemplateColorSchema.optional(),
  colorToken: KnowledgeExplainerTemplateColorTokenSchema.optional(),
  backgroundColor: KnowledgeExplainerTemplateColorSchema.optional(),
  backgroundToken: KnowledgeExplainerTemplateColorTokenSchema.optional(),
  border: z.object({
    width: z.number().nonnegative(),
    color: KnowledgeExplainerTemplateColorSchema.optional(),
    colorToken: KnowledgeExplainerTemplateColorTokenSchema,
    radius: z.number().nonnegative()
  }).optional(),
  footer: z.object({
    columnCount: z.number().int().positive(),
    columnWidth: z.number().positive(),
    dividerWidth: z.number().nonnegative(),
    contentHeight: z.number().positive()
  }).optional(),
  image: z.object({ objectFit: z.enum(["contain", "cover"]) }).optional()
});

export const KnowledgeExplainerVideoTemplateSchema = z.object({
  kind: z.literal("knowledge-explainer-template"),
  id: KnowledgeExplainerTemplateIdSchema,
  application: z.object({ id: z.string().min(1), displayName: z.string().min(1) }),
  scenario: z.object({ id: z.string().min(1), displayName: z.string().min(1) }),
  defaultViewId: KnowledgeExplainerViewIdSchema,
  canvas: CanvasFormatSchema,
  modules: z.array(KnowledgeExplainerTemplateModuleSchema).min(1)
}).superRefine((template, context) => {
  const moduleIds = new Set<string>();
  for (const [index, module] of template.modules.entries()) {
    if (moduleIds.has(module.id)) {
      context.addIssue({ code: "custom", path: ["modules", index, "id"], message: `duplicate module id ${module.id}` });
    }
    moduleIds.add(module.id);
    if (module.rect.x + module.rect.width > template.canvas.width || module.rect.y + module.rect.height > template.canvas.height) {
      context.addIssue({ code: "custom", path: ["modules", index, "rect"], message: `module ${module.id} exceeds the template canvas` });
    }
    if (module.fitting && module.text) {
      const requiredHeight = module.fitting.maxLines * module.text.fontSize * module.text.lineHeight;
      if (requiredHeight > module.rect.height) {
        context.addIssue({
          code: "custom",
          path: ["modules", index, "fitting"],
          message: `module ${module.id} text height ${requiredHeight} exceeds its reserved height ${module.rect.height}`
        });
      }
    }
    if (module.kind === "caption") {
      if (module.scope !== "scene") {
        context.addIssue({ code: "custom", path: ["modules", index, "scope"], message: "caption module must be scoped to a scene" });
      }
      if (!module.text || !module.fitting) {
        context.addIssue({ code: "custom", path: ["modules", index], message: "caption module requires text and fitting contracts" });
      }
    }
  }
});

function resolveKnowledgeExplainerTemplateCharacterAdvance(
  character: string,
  metrics: KnowledgeExplainerCaptionMetric
): number {
  if (/\s/.test(character)) {
    return metrics.whitespaceAdvance;
  }
  if (/[，。！？、：；,.!?()（）]/.test(character)) {
    return metrics.punctuationAdvance;
  }
  if (/[\u3400-\u9FFF]/.test(character)) {
    return metrics.cjkAdvance;
  }
  return metrics.latinAdvance;
}

/**
 * 使用模板声明的字形宽度近似值估算单行文本宽度。
 * 它不是浏览器字形测量的替代品，而是编译、验收和渲染前排版共享的确定性约束。
 */
export function estimateKnowledgeExplainerTemplateTextWidth(
  text: string,
  style: KnowledgeExplainerTemplateTextStyle,
  metrics: KnowledgeExplainerCaptionMetric
): number {
  const characters = Array.from(text);
  const advanceWidth = characters.reduce(
    (total, character) => total + resolveKnowledgeExplainerTemplateCharacterAdvance(character, metrics) * style.fontSize,
    0
  );
  return advanceWidth + Math.max(0, characters.length - 1) * style.letterSpacing;
}

export function resolveKnowledgeExplainerTemplateCjkLineCapacity(module: KnowledgeExplainerTemplateModule): number {
  if (!module.text || !module.fitting) {
    throw new Error(`Template module ${module.id} requires text and fitting contracts to calculate capacity.`);
  }
  const characterWidth = module.text.fontSize * module.fitting.metrics.cjkAdvance + module.text.letterSpacing;
  return Math.floor((module.rect.width + module.text.letterSpacing) / characterWidth);
}

export const KnowledgeExplainerSeriesProfileSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  creationMethodId: KnowledgeExplainerCreationMethodIdSchema,
  templateId: KnowledgeExplainerTemplateIdSchema.default("illustrated-caption"),
  themeId: z.literal("illustrated-caption-editorial"),
  defaultViewId: KnowledgeExplainerViewIdSchema.default("portrait-3x4"),
  signatureLine: z.string().min(1),
  disclaimer: KnowledgeExplainerTwoLineDisclaimerSchema,
  footerTagIds: z.array(z.string().min(1)).length(3),
  illustrationSystem: KnowledgeExplainerIllustrationSystemSchema,
  narration: z.object({
    voiceByLanguage: z.object({
      zh: z.string().min(1).optional(),
      en: z.string().min(1).optional()
    }),
    synthesis: NarrationSynthesisSettingsSchema
  }),
  backgroundId: z.string().min(1),
  backgroundMusicId: z.string().min(1)
});

export const KnowledgeExplainerAccountProfileSchema = z.object({
  kind: KnowledgeExplainerAccountKindSchema,
  id: z.string().min(1),
  markText: z.string().min(1).max(2),
  displayName: z.string().min(1),
  positioningTags: z.array(KnowledgeExplainerPositioningTagSchema).min(1),
  series: z.array(KnowledgeExplainerSeriesProfileSchema).min(1)
});

export const NarrationVoiceSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("inherit-series") }),
  z.object({ mode: z.literal("override"), voiceProfileId: z.string().trim().min(1).max(120) })
]);

// 知识讲解模板沿用该别名，避免已有制作单与调用方被迫同步改名。
export const KnowledgeExplainerVoiceSelectionSchema = NarrationVoiceSelectionSchema;

export const KnowledgeExplainerMediaSelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("inherit-series") }),
  z.object({ mode: z.literal("override"), mediaId: z.string().trim().min(1).max(120) })
]);

export const NarrationScriptSchema = z.object({
  text: z.string().trim().min(1).max(12000).refine(
    (text) => !/[\r\n]/.test(text),
    "narration script must be one continuous paragraph without display line breaks"
  )
});

export function normalizeNarrationContent(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export const KnowledgeExplainerCreationPlanCardSchema = z.object({
  id: z.string().trim().min(1).max(120),
  role: StoryBeatRoleSchema,
  spokenText: z.string().trim().min(1).max(240).refine(
    (text) => !/[\r\n]/u.test(text),
    "knowledge explainer spokenText cannot contain display line breaks"
  ),
  caption: z.string().trim().min(1).max(240),
  illustrationAssetId: z.string().trim().min(1).max(120),
  illustrationCueId: z.string().trim().min(1).max(120)
});

export const KnowledgeExplainerFooterColumnSchema = z.object({
  topLine: z.string().min(1),
  bottomLine: z.string().min(1)
});

export const KnowledgeExplainerCreationPlanSchema = z.object({
  kind: z.literal("knowledge-explainer-plan"),
  id: z.string().min(1),
  creationMethodId: KnowledgeExplainerCreationMethodIdSchema,
  templateId: KnowledgeExplainerTemplateIdSchema,
  episode: z.object({
    accountId: z.string().trim().min(1).max(120),
    seriesId: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(80),
    language: TtsVoiceLanguageSchema
  }),
  presentation: z.object({
    background: KnowledgeExplainerMediaSelectionSchema,
    backgroundMusic: KnowledgeExplainerMediaSelectionSchema
  }).optional(),
  narration: z.object({
    voice: KnowledgeExplainerVoiceSelectionSchema.optional(),
    script: NarrationScriptSchema
  }),
  cards: z.array(KnowledgeExplainerCreationPlanCardSchema).min(1).max(120)
}).strict().superRefine((plan, context) => {
  const cardIds = new Set<string>();
  for (const [index, card] of plan.cards.entries()) {
    if (cardIds.has(card.id)) {
      context.addIssue({ code: "custom", path: ["cards", index, "id"], message: `duplicate knowledge explainer card id ${card.id}` });
    }
    cardIds.add(card.id);
    if (/\p{P}/u.test(card.caption)) {
      context.addIssue({
        code: "custom",
        path: ["cards", index, "caption"],
        message: "knowledge explainer display caption cannot contain punctuation"
      });
    }
    if (normalizeNarrationContent(card.spokenText) !== normalizeNarrationContent(card.caption)) {
      context.addIssue({
        code: "custom",
        path: ["cards", index, "caption"],
        message: "knowledge explainer display caption must match spokenText after removing punctuation and line breaks"
      });
    }
  }
  const narrationContent = normalizeNarrationContent(plan.narration.script.text);
  const captionContent = normalizeNarrationContent(
    plan.cards.map((card) => card.spokenText).join("")
  );
  if (narrationContent !== captionContent) {
    context.addIssue({
      code: "custom",
      path: ["narration", "script", "text"],
      message: "narration script must match the caption content after removing punctuation and display line breaks"
    });
  }
});

export const KnowledgeExplainerIdentitySchema = z.object({
  accountId: z.string().min(1),
  accountMarkText: z.string().min(1),
  accountName: z.string().min(1),
  seriesId: z.string().min(1),
  seriesName: z.string().min(1),
  episodeTitle: z.string().min(1),
  signatureLine: z.string().min(1),
  disclaimer: z.string().min(1),
  footerColumns: z.array(KnowledgeExplainerFooterColumnSchema).length(3),
  illustrationSystem: KnowledgeExplainerIllustrationSystemSchema,
  narration: z.object({
    language: TtsVoiceLanguageSchema,
    voiceProfileId: z.string().min(1),
    synthesis: NarrationSynthesisSettingsSchema
  }),
  background: KnowledgeExplainerBackgroundSchema,
  backgroundMusic: KnowledgeExplainerBackgroundMusicSchema
});

export const FormatSafeAreaSchema = z.object({
  top: z.number().int().nonnegative(),
  right: z.number().int().nonnegative(),
  bottom: z.number().int().nonnegative(),
  left: z.number().int().nonnegative()
});

export const KnowledgeExplainerViewProfileSchema = z.object({
  id: KnowledgeExplainerViewIdSchema,
  creationMethodId: KnowledgeExplainerCreationMethodIdSchema,
  format: CanvasFormatSchema,
  safeArea: FormatSafeAreaSchema
});

export const KnowledgeExplainerLayoutRendererSchema = z.literal("knowledge-explainer-caption");

export const KnowledgeExplainerSceneSchema = z.object({
  id: z.string().min(1),
  role: StoryBeatRoleSchema,
  layoutId: z.string().min(1),
  layoutRenderer: KnowledgeExplainerLayoutRendererSchema,
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  eyebrow: z.string().min(1),
  headline: z.string().min(1),
  supportingLine: z.string().min(1).optional(),
  illustration: ResolvedKnowledgeExplainerIllustrationSchema,
  illustrationCueId: z.string().min(1).optional()
});

export const KnowledgeExplainerIllustrationCueSchema = z.object({
  id: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  illustration: ResolvedKnowledgeExplainerIllustrationSchema
});

export const KnowledgeExplainerThemeCardSchema = z.object({
  eyebrow: z.string().min(1),
  primaryTitle: z.string().min(1),
  emphasisTitle: z.string().min(1),
  illustration: ResolvedKnowledgeExplainerIllustrationSchema
});

export const KnowledgeExplainerFramingSchema = z.object({
  introDurationInFrames: z.number().int().positive(),
  outroDurationInFrames: z.number().int().positive(),
  cover: KnowledgeExplainerThemeCardSchema,
  closing: KnowledgeExplainerThemeCardSchema
});

export const KnowledgeExplainerProductionLockSchema = z.object({
  kind: z.literal("knowledge-explainer-production"),
  id: z.string().min(1),
  creationMethodId: KnowledgeExplainerCreationMethodIdSchema,
  templateId: KnowledgeExplainerTemplateIdSchema,
  title: z.string().min(1),
  episodeId: z.string().min(1),
  knowledgeExplainer: KnowledgeExplainerIdentitySchema,
  themeId: z.literal("illustrated-caption-editorial"),
  seed: z.number().int(),
  view: KnowledgeExplainerViewProfileSchema,
  format: CanvasFormatSchema,
  durationSeconds: z.number().int().positive(),
  durationInFrames: z.number().int().positive(),
  framing: KnowledgeExplainerFramingSchema,
  scenes: z.array(KnowledgeExplainerSceneSchema).min(1),
  illustrationCues: z.array(KnowledgeExplainerIllustrationCueSchema).min(1).optional(),
  narration: NarrationSchema
}).superRefine(refineNarrationSpeechDensityContract);

export type NarrationSpeechDensitySegment = {
  id: string;
  text: string;
  startMs: number;
  speechEndMs: number;
};

export type NarrationSpeechDensityContract = {
  timingSource: NarrationTimingSource;
  segments: NarrationSpeechDensitySegment[];
};

export type NarrationSpeechDensityIssue = {
  segmentIndex: number;
  message: string;
};

type NarrationTimedProduction = {
  format: CanvasFormat;
  narration: Narration;
};

const minimumNarrationMillisecondsPerSpokenCharacter = 40;

/**
 * 实测时间轴必须为对应正文保留可实现的语音跨度。这里只拦截超过每秒 25 个有效字符的物理异常，
 * 不把正常语速、停顿或表达风格固化到业务契约中。
 */
export function findNarrationSpeechDensityIssues(
  contract: NarrationSpeechDensityContract
): NarrationSpeechDensityIssue[] {
  if (contract.timingSource !== "measured") {
    return [];
  }
  return contract.segments.flatMap((segment, segmentIndex) => {
    const spokenCharacterCount = Array.from(normalizeNarrationContent(segment.text)).length;
    const speechDurationMs = Math.max(0, segment.speechEndMs - segment.startMs);
    const minimumSpeechDurationMs = spokenCharacterCount * minimumNarrationMillisecondsPerSpokenCharacter;
    if (spokenCharacterCount === 0 || speechDurationMs >= minimumSpeechDurationMs) {
      return [];
    }
    return [{
      segmentIndex,
      message: `narration segment ${segment.id} has ${spokenCharacterCount} spoken characters in ${speechDurationMs}ms; minimum is ${minimumSpeechDurationMs}ms`
    }];
  });
}

function refineNarrationSpeechDensityContract(
  production: NarrationTimedProduction,
  context: z.RefinementCtx
): void {
  const millisecondsPerFrame = 1000 / production.format.fps;
  const issues = findNarrationSpeechDensityIssues({
    timingSource: production.narration.timingSource,
    segments: production.narration.segments.map((segment) => ({
      id: segment.id,
      text: segment.text,
      startMs: Math.round(segment.startFrame * millisecondsPerFrame),
      speechEndMs: Math.round((segment.speechEndFrame ?? segment.endFrame) * millisecondsPerFrame)
    }))
  });
  for (const issue of issues) {
    context.addIssue({
      code: "custom",
      path: ["narration", "segments", issue.segmentIndex, "endFrame"],
      message: issue.message
    });
  }
}

export type CanvasFormat = z.infer<typeof CanvasFormatSchema>;

export type NarrationDirection = z.infer<typeof NarrationDirectionSchema>;

export type NarrationSegment = z.infer<typeof NarrationSegmentSchema>;

export type NarrationTimingSource = z.infer<typeof NarrationTimingSourceSchema>;

export type Narration = z.infer<typeof NarrationSchema>;

export type NarrationTimingMap = z.infer<typeof NarrationTimingMapSchema>;

export type NarrationEmotion = z.infer<typeof NarrationEmotionSchema>;

export type TtsProviderId = z.infer<typeof TtsProviderIdSchema>;

export type TtsVoiceLanguage = z.infer<typeof TtsVoiceLanguageSchema>;

export type TtsVoiceProfile = z.infer<typeof TtsVoiceProfileSchema>;

export type TtsCatalog = z.infer<typeof TtsCatalogSchema>;

export type NarrationSynthesisSettings = z.infer<typeof NarrationSynthesisSettingsSchema>;

export type CartesiaSynthesisSettings = z.infer<typeof CartesiaSynthesisSettingsSchema>;

export type CartesiaConfig = z.infer<typeof CartesiaConfigSchema>;

export type VolcengineTtsAudioConfig = z.infer<typeof VolcengineTtsAudioConfigSchema>;

export type VolcengineTtsConfig = z.infer<typeof VolcengineTtsConfigSchema>;

export type CartesiaPronunciationEntry = z.infer<typeof CartesiaPronunciationEntrySchema>;

export type CartesiaPronunciationCatalog = z.infer<typeof CartesiaPronunciationCatalogSchema>;

export type CreationMethodId = z.infer<typeof CreationMethodIdSchema>;

export type SubjectAssetCatalog = z.infer<typeof SubjectAssetCatalogSchema>;

export type TemplateDesignDataField = z.infer<typeof TemplateDesignDataFieldSchema>;

export type TemplateDesignRect = z.infer<typeof TemplateDesignRectSchema>;

export type TemplateDesignTextStyle = z.infer<typeof TemplateDesignTextStyleSchema>;

export type TemplateDesignSurfaceStyle = z.infer<typeof TemplateDesignSurfaceStyleSchema>;

export type TemplateDesignLayer = z.infer<typeof TemplateDesignLayerSchema>;

export type TemplateDesignView = z.infer<typeof TemplateDesignViewSchema>;

export type VideoTemplateDesign = z.infer<typeof VideoTemplateDesignSchema>;

export type StoryBeatRole = z.infer<typeof StoryBeatRoleSchema>;

export type KnowledgeExplainerIllustrationCatalog = z.infer<typeof KnowledgeExplainerIllustrationCatalogSchema>;

export type KnowledgeExplainerBackground = z.infer<typeof KnowledgeExplainerBackgroundSchema>;

export type KnowledgeExplainerBackgroundMusic = z.infer<typeof KnowledgeExplainerBackgroundMusicSchema>;

export type KnowledgeExplainerMediaCatalog = z.infer<typeof KnowledgeExplainerMediaCatalogSchema>;

export type ResolvedKnowledgeExplainerIllustration = z.infer<typeof ResolvedKnowledgeExplainerIllustrationSchema>;

export type KnowledgeExplainerTemplateId = z.infer<typeof KnowledgeExplainerTemplateIdSchema>;

export type KnowledgeExplainerViewId = z.infer<typeof KnowledgeExplainerViewIdSchema>;

export type KnowledgeExplainerTemplateColorToken = z.infer<typeof KnowledgeExplainerTemplateColorTokenSchema>;

export type KnowledgeExplainerTemplateTextStyle = z.infer<typeof KnowledgeExplainerTemplateTextStyleSchema>;

export type KnowledgeExplainerCaptionMetric = z.infer<typeof KnowledgeExplainerCaptionMetricSchema>;

export type KnowledgeExplainerTemplateTextFitting = z.infer<typeof KnowledgeExplainerTemplateTextFittingSchema>;

export type KnowledgeExplainerTemplateModuleKind = z.infer<typeof KnowledgeExplainerTemplateModuleKindSchema>;

export type KnowledgeExplainerTemplateModule = z.infer<typeof KnowledgeExplainerTemplateModuleSchema>;

export type KnowledgeExplainerVideoTemplate = z.infer<typeof KnowledgeExplainerVideoTemplateSchema>;

export type KnowledgeExplainerSeriesProfile = z.infer<typeof KnowledgeExplainerSeriesProfileSchema>;

export type KnowledgeExplainerAccountProfile = z.infer<typeof KnowledgeExplainerAccountProfileSchema>;

export type KnowledgeExplainerVoiceSelection = z.infer<typeof KnowledgeExplainerVoiceSelectionSchema>;

export type KnowledgeExplainerMediaSelection = z.infer<typeof KnowledgeExplainerMediaSelectionSchema>;

export type KnowledgeExplainerCreationPlanCard = z.infer<typeof KnowledgeExplainerCreationPlanCardSchema>;

export type KnowledgeExplainerFooterColumn = z.infer<typeof KnowledgeExplainerFooterColumnSchema>;

export type KnowledgeExplainerCreationPlan = z.infer<typeof KnowledgeExplainerCreationPlanSchema>;

export type KnowledgeExplainerIdentity = z.infer<typeof KnowledgeExplainerIdentitySchema>;

export type KnowledgeExplainerViewProfile = z.infer<typeof KnowledgeExplainerViewProfileSchema>;

export type KnowledgeExplainerLayoutRenderer = z.infer<typeof KnowledgeExplainerLayoutRendererSchema>;

export type KnowledgeExplainerScene = z.infer<typeof KnowledgeExplainerSceneSchema>;

export type KnowledgeExplainerIllustrationCue = z.infer<typeof KnowledgeExplainerIllustrationCueSchema>;

export type KnowledgeExplainerThemeCard = z.infer<typeof KnowledgeExplainerThemeCardSchema>;

export type KnowledgeExplainerFraming = z.infer<typeof KnowledgeExplainerFramingSchema>;

export type KnowledgeExplainerProductionLock = z.infer<typeof KnowledgeExplainerProductionLockSchema>;
