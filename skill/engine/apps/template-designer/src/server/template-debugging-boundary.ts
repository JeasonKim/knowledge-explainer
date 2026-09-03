import type {
  TemplateDesignDataField,
  TemplateDesignLayer,
  TemplateDesignView,
  VideoTemplateDesign
} from "@knowledge-explainer/contracts";

type FixedFieldContract = Omit<TemplateDesignDataField, "sampleValue">;

type FixedLayerContract = Pick<
  TemplateDesignLayer,
  "id" | "displayName" | "kind" | "scope" | "fieldId" | "zIndex"
> & {
  textStyleCapabilities: string[];
  imageStyleCapabilities: string[];
  surfaceStyleCapabilities: string[];
};

type FixedViewContract = Omit<TemplateDesignView, "layers"> & {
  layers: FixedLayerContract[];
};

type FixedTemplateContract = Omit<VideoTemplateDesign, "fields" | "views"> & {
  fields: FixedFieldContract[];
  views: FixedViewContract[];
};

type FixedImageFieldValue = Pick<TemplateDesignDataField, "id" | "sampleValue">;

type FixedImageLayerStyle = Pick<TemplateDesignLayer, "id" | "image">;

type FixedImageView = Pick<TemplateDesignView, "id"> & {
  layers: FixedImageLayerStyle[];
};

type FixedTemplateImages = {
  fields: FixedImageFieldValue[];
  views: FixedImageView[];
};

function omitSampleValue(field: TemplateDesignDataField): FixedFieldContract {
  const { sampleValue: _sampleValue, ...contract } = field;
  return contract;
}

function captureStyleCapabilities(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }
  return Object.entries(value).flatMap(([key, nestedValue]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const nestedPaths = captureStyleCapabilities(nestedValue, path);
    return nestedPaths.length > 0 ? [path, ...nestedPaths] : [path];
  }).sort();
}

function captureLayerContract(layer: TemplateDesignLayer): FixedLayerContract {
  return {
    id: layer.id,
    displayName: layer.displayName,
    kind: layer.kind,
    scope: layer.scope,
    fieldId: layer.fieldId,
    zIndex: layer.zIndex,
    textStyleCapabilities: captureStyleCapabilities(layer.text),
    imageStyleCapabilities: captureStyleCapabilities(layer.image),
    surfaceStyleCapabilities: captureStyleCapabilities(layer.surface)
  };
}

function captureFixedContract(design: VideoTemplateDesign): FixedTemplateContract {
  return {
    kind: design.kind,
    id: design.id,
    creationMethodId: design.creationMethodId,
    displayName: design.displayName,
    fields: design.fields.map(omitSampleValue),
    views: design.views.map((view) => ({
      id: view.id,
      displayName: view.displayName,
      canvas: view.canvas,
      safeArea: view.safeArea,
      layers: view.layers.map(captureLayerContract)
    }))
  };
}

function captureFixedImages(design: VideoTemplateDesign): FixedTemplateImages {
  return {
    fields: design.fields
      .filter((field) => field.valueType === "image")
      .map((field) => ({ id: field.id, sampleValue: field.sampleValue })),
    views: design.views.map((view) => ({
      id: view.id,
      layers: view.layers
        .filter((layer) => layer.image !== undefined)
        .map((layer) => ({ id: layer.id, image: layer.image }))
    }))
  };
}

function representSameBoundary(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * 调试器只允许改文字样例和已声明的视觉参数；契约身份、字段绑定与能力结构保持固定。
 */
export function assertTemplateDebuggingDraftKeepsContract(
  persisted: VideoTemplateDesign,
  draft: VideoTemplateDesign
): void {
  if (!representSameBoundary(captureFixedContract(persisted), captureFixedContract(draft))) {
    throw new Error("模板调试保存失败：字段、视图与槽位结构固定，只能调整文字样例和已有视觉参数。");
  }

  if (!representSameBoundary(captureFixedImages(persisted), captureFixedImages(draft))) {
    throw new Error("模板调试保存失败：图片字段暂不支持调整。");
  }
}
