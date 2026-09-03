import { VideoTemplateDesignSchema, type CreationMethodId, type TemplateDesignLayer,
  type TemplateDesignView, type VideoTemplateDesign } from "@knowledge-explainer/contracts";
import templateSource from "./templates/knowledge-explainer/illustrated-caption/template.json";

const templateDesign = VideoTemplateDesignSchema.parse(templateSource);

export function listTemplateDesigns(): VideoTemplateDesign[] {
  return [templateDesign];
}

export function getTemplateDesign(creationMethodId: CreationMethodId, templateId: string): VideoTemplateDesign {
  if (creationMethodId !== templateDesign.creationMethodId || templateId !== templateDesign.id) {
    throw new Error(`Unknown template design ${creationMethodId}/${templateId}.`);
  }
  return templateDesign;
}

export function getTemplateDesignView(template: VideoTemplateDesign, viewId: string): TemplateDesignView {
  const view = template.views.find((candidate) => candidate.id === viewId);
  if (!view) throw new Error(`Template ${template.creationMethodId}/${template.id} does not support view ${viewId}.`);
  return view;
}

export function getTemplateDesignLayer(template: VideoTemplateDesign, viewId: string, layerId: string): TemplateDesignLayer {
  const layer = getTemplateDesignView(template, viewId).layers.find((candidate) => candidate.id === layerId);
  if (!layer) throw new Error(`Template ${template.creationMethodId}/${template.id}/${viewId} does not define layer ${layerId}.`);
  return layer;
}
