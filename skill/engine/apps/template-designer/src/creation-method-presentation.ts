import type { CreationMethodId, TemplateDesignDataField } from "@knowledge-explainer/contracts";

export type TemplateDesignSummary = {
  creationMethodId: CreationMethodId;
  templateId: string;
  displayName: string;
  views: Array<{ id: string; displayName: string }>;
};

export type CreationMethodExperience = {
  id: CreationMethodId;
  displayName: string;
  shortDescription: string;
  exampleTitle: string;
  exampleSummary: string;
  templateIntent: string;
  previewStates: Array<{ id: string; displayName: string; description: string }>;
  defaultPreviewStateId: string;
  capabilities: Array<{ id: string; displayName: string; description: string }>;
  materials: Array<{ name: string; role: string; src?: string }>;
  caseAssetByFieldId: Partial<Record<string, string>>;
};

const experience: CreationMethodExperience = {
  id: "knowledge-explainer",
  displayName: "知识讲解",
  shortDescription: "用连续旁白、语义字幕和主题插画解释复杂概念。",
  exampleTitle: "把复杂知识讲成一条清晰路径",
  exampleSummary: "用通用学习场景展示标题、字幕、插画与账号信息的完整关系。",
  templateIntent: "稳定呈现账号信息、核心字幕与逐场景插画，适合概念、机制和因果讲解。",
  previewStates: [
    { id: "theme-cover", displayName: "主题封面", description: "双层主题标题建立开场。" },
    { id: "content", displayName: "正文讲解", description: "字幕与逐场景插画共同讲解。" },
    { id: "theme-closing", displayName: "主题收束", description: "回看主题并结束本期内容。" }
  ],
  defaultPreviewStateId: "content",
  capabilities: [
    { id: "dual-theme-title", displayName: "双层主题标题", description: "主题页拆分主句与强调句。" },
    { id: "illustrated-caption", displayName: "插画字幕讲解", description: "大字幕与插画形成双焦点。" },
    { id: "three-column-footer", displayName: "三栏账号页脚", description: "账号定位以三栏固定呈现。" }
  ],
  materials: [
    { name: "学习路径插画", role: "逐场景素材", src: "/cases/knowledge-learning-map.png" },
    { name: "讲解字幕与标题", role: "创作计划字段" }
  ],
  caseAssetByFieldId: { "scene.illustration": "/cases/knowledge-learning-map.png" }
};

export function presentCreationMethodExperience(creationMethodId: CreationMethodId): CreationMethodExperience {
  if (creationMethodId !== experience.id) throw new Error(`创作方式 ${creationMethodId} 缺少调试器呈现定义。`);
  return experience;
}

export function presentCaseAsset(creationMethodId: CreationMethodId, fieldId?: string): string | undefined {
  return fieldId ? presentCreationMethodExperience(creationMethodId).caseAssetByFieldId[fieldId] : undefined;
}

export function presentAllowedFieldValue(_fieldId: string, value: string): string {
  return value;
}

export type TemplateSampleField = Pick<TemplateDesignDataField, "id" | "sampleValue">;
