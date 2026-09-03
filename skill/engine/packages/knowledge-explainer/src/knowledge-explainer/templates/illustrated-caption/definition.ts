import type {
  KnowledgeExplainerTemplateId,
  KnowledgeExplainerTemplateModule,
  KnowledgeExplainerTemplateModuleKind,
  KnowledgeExplainerTemplateTextFitting,
  KnowledgeExplainerTemplateTextStyle,
  KnowledgeExplainerVideoTemplate,
  KnowledgeExplainerLayoutRenderer,
  KnowledgeExplainerViewId,
  KnowledgeExplainerViewProfile,
  StoryBeatRole
} from "@knowledge-explainer/contracts";
import {
  KnowledgeExplainerVideoTemplateSchema,
  resolveKnowledgeExplainerTemplateCjkLineCapacity
} from "@knowledge-explainer/contracts";
import {
  getTemplateDesign,
  getTemplateDesignView
} from "@knowledge-explainer/template-design";
import type { TemplateDesignLayer, TemplateDesignView } from "@knowledge-explainer/contracts";
import {
  assertKnowledgeExplainerIllustrationAspectRatio,
  knowledgeExplainerIllustrationDisplaySpec,
  resolveContainedIllustrationDimensions
} from "./illustration-display-contract";

export {
  assertKnowledgeExplainerIllustrationAspectRatio,
  knowledgeExplainerIllustrationDisplaySpec
} from "./illustration-display-contract";

export type ThemeId = "illustrated-caption-editorial";

export type CopyField = "headline";

export type CopySlotContract = {
  field: CopyField;
  maxVisualChars: number;
  maxVisualCharsPerLine?: number;
  maxLines: number;
  overflow: "reject" | "shrink-to-min";
};

export type VisualTextBudget = {
  maxVisualChars: number;
  maxLines: number;
  overflow: "reject" | "shrink-to-min";
};

export type LayoutRepeatPolicy = {
  maxConsecutive: number;
  minimumGap: number;
};

export type MediaSlotContract = {
  id: "illustration";
  aspectRatio: number;
  fit: "contain" | "cover";
  required: boolean;
};

export type SceneLayoutContract = {
  id: string;
  themeId: ThemeId;
  viewId: KnowledgeExplainerViewId;
  roles: StoryBeatRole[];
  renderer: KnowledgeExplainerLayoutRenderer;
  copy: CopySlotContract[];
  mediaSlots: MediaSlotContract[];
  repeatPolicy: LayoutRepeatPolicy;
};

export type ThemeTokens = {
  canvas: string;
  ink: string;
  mutedInk: string;
  accent: string;
  secondaryAccent: string;
  rule: string;
  captionCanvas: string;
};

export type ThemePack = {
  id: ThemeId;
  tokens: ThemeTokens;
  layouts: SceneLayoutContract[];
};

export type KnowledgeExplainerTemplateCapabilities = {
  templateId: KnowledgeExplainerTemplateId;
  viewId: KnowledgeExplainerViewId;
  format: KnowledgeExplainerViewProfile["format"];
  caption: {
    maxLines: number;
    maxCjkCharactersPerLine: number;
    overflowPolicy: "reject";
  };
  illustration: {
    required: true;
    preferredAspectRatio: number;
    fit: "contain" | "cover";
  };
};

export type KnowledgeExplainerIllustrationDisplayMetrics = {
  renderedWidth: number;
  renderedHeight: number;
  illustrationToCaptionAreaRatio: number;
};

const knowledgeExplainerTemplateDesign = getTemplateDesign("knowledge-explainer", "illustrated-caption");

function compileKnowledgeExplainerViewProfile(view: TemplateDesignView): KnowledgeExplainerViewProfile {
  return {
    id: view.id as KnowledgeExplainerViewId,
    format: view.canvas,
    safeArea: view.safeArea,
    creationMethodId: "knowledge-explainer"
  };
}

const viewProfiles = Object.fromEntries(
  knowledgeExplainerTemplateDesign.views.map((view) => [
    view.id,
    compileKnowledgeExplainerViewProfile(view)
  ])
) as Record<KnowledgeExplainerViewId, KnowledgeExplainerViewProfile>;

const knowledgeExplainerRoles: StoryBeatRole[] = [
  "hook",
  "claim",
  "contrast",
  "example",
  "framework",
  "takeaway",
  "end-card"
];


function buildKnowledgeExplainerLayouts(
  themeId: ThemeId,
  viewId: KnowledgeExplainerViewId
): SceneLayoutContract[] {
  const template = getKnowledgeExplainerVideoTemplate("illustrated-caption", viewId);
  const caption = getKnowledgeExplainerTemplateModule(template, "caption");
  const illustration = getKnowledgeExplainerTemplateModule(template, "illustration");
  const captionText = caption.text;
  const captionFitting = caption.fitting;
  if (!captionText || !captionFitting) {
    throw new Error(`KnowledgeExplainer template ${template.id} requires a complete caption text contract.`);
  }
  const lineCapacity = resolveTextModuleLineCapacity(caption);
  return [{
    id: `${themeId}/knowledge-explainer/${viewId}/caption-card`,
    themeId,
    viewId,
    roles: knowledgeExplainerRoles,
    renderer: "knowledge-explainer-caption",
    copy: [{
      field: "headline",
      maxVisualChars: lineCapacity * captionFitting.maxLines,
      maxLines: captionFitting.maxLines,
      overflow: captionFitting.overflow === "split-scene" ? "reject" : "shrink-to-min"
    }],
    mediaSlots: [{
      id: "illustration",
      aspectRatio: illustration.rect.width / illustration.rect.height,
      fit: "contain",
      required: true
    }],
    repeatPolicy: { maxConsecutive: 99, minimumGap: 0 }
  }];
}

const knowledgeExplainerModuleKinds: Record<string, KnowledgeExplainerTemplateModuleKind> = {
  "account-mark": "account-mark",
  "account-name": "account-name",
  "episode-title": "episode-title",
  caption: "caption",
  signature: "signature",
  illustration: "illustration",
  disclaimer: "disclaimer",
  footer: "footer"
};

const defaultTextMetrics = {
  cjkAdvance: 1,
  latinAdvance: 0.58,
  punctuationAdvance: 0.3,
  whitespaceAdvance: 0.28
};

function resolveKnowledgeExplainerTemplateWhiteSpace(
  layer: TemplateDesignLayer
): KnowledgeExplainerTemplateTextStyle["whiteSpace"] {
  if (layer.id === "caption") {
    return "pre";
  }
  return layer.id === "disclaimer" ? "pre-line" : "nowrap";
}

function compileKnowledgeExplainerTextStyle(
  layer: TemplateDesignLayer
): KnowledgeExplainerTemplateTextStyle | undefined {
  if (!layer.text) {
    return undefined;
  }
  return {
    fontFamily: layer.text.fontFamily,
    fontSize: layer.text.fontSize,
    fontWeight: layer.text.fontWeight,
    lineHeight: layer.text.lineHeight,
    letterSpacing: layer.text.letterSpacing,
    textAlign: layer.text.textAlign,
    whiteSpace: resolveKnowledgeExplainerTemplateWhiteSpace(layer),
    colorToken: layer.id === "episode-title" ? "accent" : "ink"
  };
}

function compileKnowledgeExplainerTextFitting(
  layer: TemplateDesignLayer
): KnowledgeExplainerTemplateTextFitting | undefined {
  if (!layer.text) {
    return undefined;
  }
  return {
    maxLines: layer.text.maxLines,
    overflow: layer.id === "caption" ? "split-scene" : "reject",
    breakPriority: layer.id === "caption"
      ? ["sentence", "punctuation", "character"]
      : layer.id === "disclaimer" ? ["punctuation", "character"] : ["character"],
    metrics: defaultTextMetrics
  };
}

function compileKnowledgeExplainerTemplateModule(layer: TemplateDesignLayer): KnowledgeExplainerTemplateModule {
  const kind = knowledgeExplainerModuleKinds[layer.id];
  if (!kind) {
    throw new Error(`KnowledgeExplainer template does not support layer ${layer.id}.`);
  }
  const text = compileKnowledgeExplainerTextStyle(layer);
  const fitting = compileKnowledgeExplainerTextFitting(layer);
  const footer = layer.id === "footer" ? {
    columnCount: 3,
    columnWidth: Math.floor(layer.rect.width * (layer.rect.width > 1_500 ? 0.247 : 0.254)),
    dividerWidth: 2,
    contentHeight: 70
  } : undefined;
  return {
    id: layer.id,
    kind,
    scope: layer.scope,
    zIndex: layer.zIndex,
    rect: layer.rect,
    text,
    fitting,
    color: layer.text?.color,
    backgroundColor: layer.surface?.fill,
    border: layer.surface?.borderWidth === undefined ? undefined : {
      width: layer.surface.borderWidth,
      color: layer.surface.borderColor,
      colorToken: "ink",
      radius: layer.surface.borderRadius ?? 0
    },
    footer,
    image: layer.image ? { objectFit: layer.image.objectFit === "fill" ? "cover" : layer.image.objectFit } : undefined
  };
}

export function getKnowledgeExplainerVideoTemplate(
  templateId: KnowledgeExplainerTemplateId,
  viewId: KnowledgeExplainerViewId = "portrait-3x4"
): KnowledgeExplainerVideoTemplate {
  const design = getTemplateDesign("knowledge-explainer", templateId);
  const view = getTemplateDesignView(design, viewId);
  return KnowledgeExplainerVideoTemplateSchema.parse({
    kind: "knowledge-explainer-template",
    id: templateId,
    application: { id: "video-account", displayName: "视频号" },
    scenario: { id: "knowledge-insight", displayName: "知识观点短视频" },
    defaultViewId: viewId,
    canvas: view.canvas,
    modules: view.layers.map(compileKnowledgeExplainerTemplateModule)
  });
}

export function getKnowledgeExplainerTemplateModule(
  template: KnowledgeExplainerVideoTemplate,
  kind: KnowledgeExplainerTemplateModuleKind
): KnowledgeExplainerTemplateModule {
  const module = template.modules.find((candidate) => candidate.kind === kind);
  if (!module) {
    throw new Error(`KnowledgeExplainer template ${template.id} does not define module kind=${kind}.`);
  }
  return module;
}

export function resolveTextModuleLineCapacity(module: KnowledgeExplainerTemplateModule): number {
  return resolveKnowledgeExplainerTemplateCjkLineCapacity(module);
}

/**
 * 用浏览器 contain 规则计算资源在模板中的实际像素面积，作为稳定的图文权重验收依据。
 */
export function resolveKnowledgeExplainerIllustrationDisplayMetrics(
  template: KnowledgeExplainerVideoTemplate,
  assetAspectRatio: number
): KnowledgeExplainerIllustrationDisplayMetrics {
  assertKnowledgeExplainerIllustrationAspectRatio({ width: assetAspectRatio, height: 1 });
  const caption = getKnowledgeExplainerTemplateModule(template, "caption");
  const illustration = getKnowledgeExplainerTemplateModule(template, "illustration");
  const rendered = resolveContainedIllustrationDimensions(illustration.rect, assetAspectRatio);
  const captionArea = caption.rect.width * caption.rect.height;
  return {
    renderedWidth: rendered.width,
    renderedHeight: rendered.height,
    illustrationToCaptionAreaRatio: (rendered.width * rendered.height) / captionArea
  };
}

/**
 * 向创作 Skill 暴露可写作的能力边界，不暴露坐标、字号和动画等模板实现细节。
 */
export function describeKnowledgeExplainerTemplate(
  templateId: KnowledgeExplainerTemplateId,
  viewId: KnowledgeExplainerViewId = "portrait-3x4"
): KnowledgeExplainerTemplateCapabilities {
  const template = getKnowledgeExplainerVideoTemplate(templateId, viewId);
  const caption = getKnowledgeExplainerTemplateModule(template, "caption");
  const illustration = getKnowledgeExplainerTemplateModule(template, "illustration");
  if (!caption.fitting || !illustration.image) {
    throw new Error(`KnowledgeExplainer template ${template.id} does not define complete caption and illustration capabilities.`);
  }
  return {
    templateId: template.id,
    viewId,
    format: getKnowledgeExplainerViewProfile(viewId).format,
    caption: {
      maxLines: caption.fitting.maxLines,
      maxCjkCharactersPerLine: resolveTextModuleLineCapacity(caption),
      overflowPolicy: "reject"
    },
    illustration: {
      required: true,
      preferredAspectRatio: illustration.rect.width / illustration.rect.height,
      fit: illustration.image.objectFit
    }
  };
}

const themePacks: Record<ThemeId, ThemePack> = {
  "illustrated-caption-editorial": {
    id: "illustrated-caption-editorial",
    tokens: {
      canvas: "#FFFFFF",
      ink: "#171717",
      mutedInk: "#6B6B6B",
      accent: "#D8242A",
      secondaryAccent: "#F5DEDE",
      rule: "#171717",
      captionCanvas: "#FFFFFF"
    },
    layouts: buildKnowledgeExplainerLayouts("illustrated-caption-editorial", "portrait-3x4")
  }
};

export function getKnowledgeExplainerViewProfile(viewId: KnowledgeExplainerViewId): KnowledgeExplainerViewProfile {
  const profile = viewProfiles[viewId];
  if (!profile) {
    throw new Error(`KnowledgeExplainer does not support output view ${viewId}.`);
  }
  return profile;
}

export function getThemePack(themeId: ThemeId): ThemePack {
  return themePacks[themeId];
}

export function isThemeId(value: string): value is ThemeId {
  return value === "illustrated-caption-editorial";
}

export function findLayoutCandidates(
  themeId: ThemeId,
  viewId: KnowledgeExplainerViewId,
  role: StoryBeatRole
): SceneLayoutContract[] {
  return buildKnowledgeExplainerLayouts(themeId, viewId).filter(
    (layout) => layout.roles.includes(role)
  );
}
