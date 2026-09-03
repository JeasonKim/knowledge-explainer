import { useEffect, useMemo, useRef, useState, type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { CreationMethodId,   TemplateDesignDataField, TemplateDesignLayer,
  TemplateDesignRect, TemplateDesignSurfaceStyle, TemplateDesignTextStyle, TemplateDesignView,
  VideoTemplateDesign } from "@knowledge-explainer/contracts";
import { presentIllustratedCaptionDebuggingState, presentKnowledgeExplainerFooterColumns,
  type IllustratedCaptionDebuggingPresentation, type IllustratedCaptionDebuggingStateId
} from "@knowledge-explainer/core";
import { presentAllowedFieldValue, presentCaseAsset, presentCreationMethodExperience, type CreationMethodExperience,
  type TemplateDesignSummary } from "./creation-method-presentation";
import { fitTemplateCanvasPreview, type TemplateCanvasPreviewSize } from "./template-canvas-preview-size";
import { moveTemplateLayerWithKeyboard } from "./template-layer-keyboard-movement";
import { resolveTemplateDebuggingDraftStatus } from "./template-debugging-draft";

type TemplateListResponse = { templates: TemplateDesignSummary[]; };
type TemplateResponse = { design: VideoTemplateDesign; };
type ApiRequestOptions = { method?: "GET" | "PUT"; body?: unknown; };
type TemplateDebuggerFeedback = { tone: "neutral" | "saving" | "success" | "error"; message: string; };
type CanvasDragState = { layerId: string; viewId: string; mode: "move" | "resize"; pointerId: number;
  startClientX: number; startClientY: number; startRect: TemplateDesignRect; canvasClientRect: DOMRect;
  canvas: TemplateDesignView["canvas"]; };
type LayerInspectorProps = { design: VideoTemplateDesign; view: TemplateDesignView; layer: TemplateDesignLayer;
  onLayerChanged: (layer: TemplateDesignLayer) => void; onClosed: () => void; };
type SampleFieldEditorProps = { creationMethodId: CreationMethodId; field: TemplateDesignDataField;
  onSampleChanged: (sampleValue: string) => void; };
type LayerPreviewProps = { design: VideoTemplateDesign; layer: TemplateDesignLayer; };
type CaseContractOverviewProps = { design: VideoTemplateDesign; experience: CreationMethodExperience; view: TemplateDesignView; };
type NumberControlProps = { label: string; value: number; min?: number; max?: number; step?: number;
  onChanged: (value: number) => void; };
type ColorControlProps = { label: string; value: string; onChanged: (value: string) => void; };
type KnowledgeThemeCardCasePreviewProps = { design: VideoTemplateDesign; view: TemplateDesignView;
  presentation: IllustratedCaptionDebuggingPresentation; };
type TemplateCanvasDebuggerStyle = CSSProperties & Record<`--debugger-${string}`, string>;

const initialFeedback: TemplateDebuggerFeedback = { tone: "neutral",
  message: "调整会即时出现在画布中，点击保存后才写回模板。" };

function cloneTemplateDesign(design: VideoTemplateDesign): VideoTemplateDesign {
  return structuredClone(design);
}

async function requestApi<Response>(resource: string, options: ApiRequestOptions = {}): Promise<Response> {
  const response = await fetch(resource, {
    method: options.method ?? "GET",
    headers: options.body === undefined ? undefined : { "content-type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const body = await response.json() as Response & { message?: string };
  if (!response.ok) {
    throw new Error(body.message ?? `请求失败：${response.status}`);
  }
  return body;
}

function findTemplateView(design: VideoTemplateDesign, viewId: string): TemplateDesignView {
  const view = design.views.find((candidate) => candidate.id === viewId);
  if (!view) {
    throw new Error(`模板 ${design.id} 不包含视图 ${viewId}。`);
  }
  return view;
}

function findTemplateLayer(view: TemplateDesignView, layerId: string): TemplateDesignLayer | undefined {
  return view.layers.find((candidate) => candidate.id === layerId);
}

function constrainRect(rect: TemplateDesignRect, canvas: TemplateDesignView["canvas"]): TemplateDesignRect {
  const width = Math.max(24, Math.min(rect.width, canvas.width));
  const height = Math.max(24, Math.min(rect.height, canvas.height));
  return {
    x: Math.max(0, Math.min(rect.x, canvas.width - width)),
    y: Math.max(0, Math.min(rect.y, canvas.height - height)),
    width,
    height
  };
}

function amendLayerInDesign(
  design: VideoTemplateDesign,
  viewId: string,
  layerId: string,
  amendedLayer: TemplateDesignLayer
): VideoTemplateDesign {
  const next = cloneTemplateDesign(design);
  const view = findTemplateView(next, viewId);
  view.layers = view.layers.map((candidate) => candidate.id === layerId ? amendedLayer : candidate);
  return next;
}

function amendFieldSampleInDesign(
  design: VideoTemplateDesign,
  fieldId: string,
  sampleValue: string
): VideoTemplateDesign {
  const next = cloneTemplateDesign(design);
  next.fields = next.fields.map((field) => field.id === fieldId ? { ...field, sampleValue } : field);
  return next;
}

function sampleValueForLayer(design: VideoTemplateDesign, layer: TemplateDesignLayer): string {
  return design.fields.find((field) => field.id === layer.fieldId)?.sampleValue ?? layer.displayName;
}

function requireSampleValue(design: VideoTemplateDesign, fieldId: string): string {
  const field = design.fields.find((candidate) => candidate.id === fieldId);
  if (!field) {
    throw new Error(`模板 ${design.id} 缺少固定字段 ${fieldId}。`);
  }
  return field.sampleValue;
}

function templateLayerStyle(layer: TemplateDesignLayer): Record<string, string | number | undefined> {
  const surface = layer.surface;
  return {
    left: `${layer.rect.x}px`,
    top: `${layer.rect.y}px`,
    width: `${layer.rect.width}px`,
    height: `${layer.rect.height}px`,
    zIndex: layer.zIndex,
    background: surface?.fill,
    borderColor: surface?.borderColor,
    borderWidth: surface?.borderWidth,
    borderStyle: surface?.borderWidth === undefined ? undefined : "solid",
    borderRadius: surface?.borderRadius,
    opacity: surface?.opacity
  };
}

function templateCanvasDebuggerStyle(
  canvas: TemplateDesignView["canvas"],
  previewSize: TemplateCanvasPreviewSize | undefined
): TemplateCanvasDebuggerStyle {
  const previewScale = previewSize ? previewSize.width / canvas.width : 0;
  const debuggerScale = previewScale > 0 ? 1 / previewScale : 1;
  return {
    width: `${canvas.width}px`,
    height: `${canvas.height}px`,
    transform: `scale(${previewScale})`,
    visibility: previewScale > 0 ? "visible" : "hidden",
    "--debugger-label-font-size": `${10 * debuggerScale}px`,
    "--debugger-label-offset": `${-22 * debuggerScale}px`,
    "--debugger-label-padding": `${3 * debuggerScale}px ${6 * debuggerScale}px`,
    "--debugger-outline-offset": `${2 * debuggerScale}px`,
    "--debugger-outline-width": `${2 * debuggerScale}px`,
    "--debugger-resize-handle-border": `${2 * debuggerScale}px`,
    "--debugger-resize-handle-size": `${14 * debuggerScale}px`,
    "--debugger-resize-target-offset": `${-22 * debuggerScale}px`,
    "--debugger-resize-target-size": `${44 * debuggerScale}px`
  };
}

function describeLayerKind(kind: TemplateDesignLayer["kind"]): string {
  const labels: Record<TemplateDesignLayer["kind"], string> = {
    anchor: "动画锚点",
    image: "图片槽位",
    shape: "图形层",
    text: "文字槽位"
  };
  return labels[kind];
}

function describeFieldValueType(valueType: TemplateDesignDataField["valueType"]): string {
  return valueType === "image" ? "图片" : valueType === "rich-text" ? "富文本" : "文字";
}

function SampleFieldEditor(props: SampleFieldEditorProps): ReactNode {
  const { creationMethodId, field, onSampleChanged } = props;
  const caseAsset = presentCaseAsset(creationMethodId, field.id);
  const characterLimit = field.constraints?.maxCharacters;

  return (
    <article className={`sample-field-card ${field.valueType === "image" ? "image-field" : "text-field"}`}>
      <div className="field-card-heading">
        <span className={`field-kind ${field.valueType}`}>{field.valueType === "image" ? "图" : "文"}</span>
        <div>
          <strong>{field.displayName}</strong>
          <span>{field.scope === "scene" ? "逐场景" : "全片固定"} · {describeFieldValueType(field.valueType)}</span>
        </div>
        <span className="fixed-badge">字段固定</span>
      </div>
      <div className="field-contract-path">
        <code>{field.id}</code>
        <span>{field.sourcePath}</span>
      </div>
      {field.valueType === "image" ? <div className="readonly-image-sample">
        {caseAsset
          ? <img src={caseAsset} alt={`${field.displayName}案例素材`} />
          : <div className="image-field-placeholder" aria-hidden="true">IMAGE</div>}
        <div>
          <strong>当前案例图片</strong>
          <code>{field.sampleValue}</code>
          <small>图片内容与呈现规则暂不支持调整</small>
        </div>
      </div> : <label className="sample-value-editor">
        <span>{field.constraints?.allowedValues ? "预览取值" : "预览文字"}</span>
        {field.constraints?.allowedValues ? <select
          aria-label={`${field.displayName}预览值`}
          value={field.sampleValue}
          onChange={(event) => onSampleChanged(event.target.value)}
        >
          {field.constraints.allowedValues.map((value) => <option key={value} value={value}>
            {presentAllowedFieldValue(field.id, value)} · {value}
          </option>)}
        </select> : <textarea
          aria-label={`${field.displayName}预览文字`}
          value={field.sampleValue}
          maxLength={characterLimit}
          rows={field.sampleValue.includes("\n") ? 3 : 2}
          onChange={(event) => onSampleChanged(event.target.value)}
        />}
        <small>{characterLimit ? `${field.sampleValue.length} / ${characterLimit} 字` : "修改后只更新本页预览"}</small>
      </label>}
    </article>
  );
}

function LayerPreview(props: LayerPreviewProps): ReactNode {
  const { design, layer } = props;
  const sample = sampleValueForLayer(design, layer);
  if (layer.kind === "image") {
    const caseAsset = presentCaseAsset(design.creationMethodId, layer.fieldId);
    if (caseAsset) {
      const image = <img className="case-layer-image" src={caseAsset} alt={`${layer.displayName}案例素材`}
        style={{ borderRadius: layer.image?.borderRadius, objectFit: layer.image?.objectFit ?? "cover" }} />;
      return image;
    }

    return <div className={`image-sample ${layer.id}`}><span>{layer.displayName}</span><small>{sample}</small></div>;
  }
  if (layer.kind === "anchor") return null;
  if (layer.kind === "shape") return null;
  if (layer.id === "footer") {
    const columns = presentKnowledgeExplainerFooterColumns(sample);
    return <div className="knowledge-footer-columns">{columns.map((column, index) => <div
      key={`${column.topLine}-${column.bottomLine}`} className={index < 2 ? "with-divider" : ""}>
      <span>{column.topLine}</span><span>{column.bottomLine}</span></div>)}</div>;
  }
  const text = layer.text;
  const shadow = text?.shadow;
  return <span style={{ display: "-webkit-box", width: "100%", overflow: "hidden",
    WebkitBoxOrient: "vertical", WebkitLineClamp: text?.maxLines, color: text?.color,
    fontFamily: text?.fontFamily, fontSize: text?.fontSize, fontWeight: text?.fontWeight,
    lineHeight: text?.lineHeight, letterSpacing: text?.letterSpacing, textAlign: text?.textAlign,
    WebkitTextStroke: text?.strokeColor && text.strokeWidth !== undefined
      ? `${text.strokeWidth}px ${text.strokeColor}` : undefined,
    paintOrder: text?.strokeColor ? "stroke fill" : undefined,
    textShadow: shadow ? `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px color-mix(in srgb, ${shadow.color} ${shadow.opacity * 100}%, transparent)` : undefined
  }}>{sample}</span>;
}

function KnowledgeThemeCardCasePreview(
  props: KnowledgeThemeCardCasePreviewProps
): ReactNode {
  const { design, view, presentation } = props;
  const layout = presentation.layout;
  if (presentation.frameKind !== "theme-card"
    || !layout
    || !presentation.eyebrow
    || !presentation.primaryTitle
    || !presentation.emphasisTitle) {
    return null;
  }
  const episodeTitle = findTemplateLayer(view, "episode-title");
  const caption = findTemplateLayer(view, "caption");
  const signature = findTemplateLayer(view, "signature");
  const illustration = findTemplateLayer(view, "illustration");
  if (!episodeTitle?.text || !caption?.text || !signature?.text || !illustration) {
    throw new Error(`知识讲解视图 ${view.id} 缺少主题页所需槽位。`);
  }
  const illustrationAsset = presentCaseAsset(design.creationMethodId, illustration.fieldId);
  return <div className="knowledge-theme-card" aria-label={`${presentation.state}主题页效果`}>
    <span className="theme-eyebrow" style={{ left: layout.titleLeft, top: layout.eyebrowTop, width: layout.titleWidth }}>{presentation.eyebrow}</span>
    <i className="theme-rule" style={{ left: layout.ruleLeft, top: layout.ruleTop, width: layout.ruleWidth }} />
    <strong className="theme-primary" style={{ left: layout.titleLeft, top: layout.primaryTop, width: layout.titleWidth, color: caption.text.color, fontSize: layout.primaryTitleFontSize }}>{presentation.primaryTitle}</strong>
    <strong className="theme-emphasis" style={{ left: layout.titleLeft, top: layout.emphasisTop, width: layout.titleWidth, color: episodeTitle.text.color, fontSize: layout.emphasisTitleFontSize }}>{presentation.emphasisTitle}</strong>
    {illustrationAsset ? <img src={illustrationAsset} alt="主题页案例插画" style={{ left: illustration.rect.x, top: layout.illustrationTop, width: illustration.rect.width, height: layout.illustrationHeight, objectFit: illustration.image?.objectFit ?? "contain" }} /> : null}
    <span className="theme-signature" style={{ left: layout.titleLeft, top: layout.signatureTop, width: layout.titleWidth, color: signature.text.color, fontFamily: signature.text.fontFamily, fontSize: signature.text.fontSize, fontWeight: signature.text.fontWeight, letterSpacing: signature.text.letterSpacing }}>{requireSampleValue(design, "series.signature")}</span>
  </div>;
}

function CaseContractOverview(props: CaseContractOverviewProps): ReactNode {
  const { design, experience, view } = props;
  return (
    <section className="case-contract-overview">
      <div className="case-kicker"><span>真实案例</span><small>LIVE CONTRACT</small></div>
      <h2>{experience.exampleTitle}</h2>
      <p className="case-summary">{experience.exampleSummary}</p>
      <dl className="case-facts">
        <div><dt>创作方式</dt><dd>{experience.displayName}</dd></div>
        <div><dt>呈现模板</dt><dd>{design.displayName}</dd></div>
        <div><dt>当前画幅</dt><dd>{view.displayName}</dd></div>
      </dl>
      <div className="capability-heading"><span>正式呈现能力</span><small>{experience.capabilities.length}</small></div>
      <div className="capability-list">
        {experience.capabilities.map((capability) => <div key={capability.id}>
          <strong>{capability.displayName}</strong><span>{capability.description}</span>
        </div>)}
      </div>
      <div className="material-heading"><span>案例素材</span><small>{experience.materials.length}</small></div>
      <div className="material-list">
        {experience.materials.map((material) => <div className="material-card" key={material.name}>
          {material.src ? <img src={material.src} alt="" /> : <span className="material-text-icon">Aa</span>}
          <span><strong>{material.name}</strong><small>{material.role}</small></span>
        </div>)}
      </div>
      <div className="contract-explanation">
        <span>怎样理解这份契约</span>
        <p>左侧字段决定画面里出现什么内容；槽位绑定与字段类型固定。选择画布元素后，可在这里调试它的坐标和已有样式。</p>
        <code>{design.creationMethodId}/{design.id}</code>
      </div>
    </section>
  );
}

function NumberControl(props: NumberControlProps): ReactNode {
  const { label, value, min, max, step, onChanged } = props;
  return <label className="form-field compact">
    <span>{label}</span>
    <input
      type="number"
      value={Number.isInteger(value) ? value : Number(value.toFixed(2))}
      min={min}
      max={max}
      step={step}
      onChange={(event) => {
        const nextValue = Number(event.target.value);
        if (Number.isFinite(nextValue)) {
          onChanged(nextValue);
        }
      }}
    />
  </label>;
}

function ColorControl(props: ColorControlProps): ReactNode {
  const { label, value, onChanged } = props;
  return <label className="form-field color-field">
    <span>{label}</span>
    <span className="color-control">
      <input type="color" value={value} onChange={(event) => onChanged(event.target.value.toUpperCase())} />
      <code>{value.toUpperCase()}</code>
    </span>
  </label>;
}

function LayerInspector(props: LayerInspectorProps): ReactNode {
  const { design, view, layer, onLayerChanged, onClosed } = props;
  const field = design.fields.find((candidate) => candidate.id === layer.fieldId);
  const amendRect = (key: keyof TemplateDesignRect, value: number): void => {
    onLayerChanged({ ...layer, rect: constrainRect({ ...layer.rect, [key]: value }, view.canvas) });
  };
  const amendText = (text: TemplateDesignTextStyle): void => {
    onLayerChanged({ ...layer, text });
  };
  const amendSurface = (surface: TemplateDesignSurfaceStyle): void => {
    onLayerChanged({ ...layer, surface });
  };

  return (
    <section className="inspector-section">
      <div className="inspector-title">
        <div><span>当前画面元素</span><strong>{layer.displayName}</strong></div>
        <button className="quiet-icon-button" aria-label="返回案例说明" onClick={onClosed}>返回</button>
      </div>
      <div className="locked-contract-card">
        <div><span>元素类型</span><strong>{describeLayerKind(layer.kind)}</strong></div>
        <div><span>绑定字段</span><strong>{field?.displayName ?? "无内容字段"}</strong></div>
        {field ? <code>{field.id} ← {field.sourcePath}</code> : <code>固定图形 / 动画结构</code>}
        <small>类型、绑定、作用域和层级由契约固定</small>
      </div>

      <div className="inspector-group-heading"><span>位置与尺寸</span><small>可调</small></div>
      <div className="coordinate-grid">
        <NumberControl label="X" value={layer.rect.x} min={0} onChanged={(value) => amendRect("x", value)} />
        <NumberControl label="Y" value={layer.rect.y} min={0} onChanged={(value) => amendRect("y", value)} />
        <NumberControl label="宽" value={layer.rect.width} min={24} onChanged={(value) => amendRect("width", value)} />
        <NumberControl label="高" value={layer.rect.height} min={24} onChanged={(value) => amendRect("height", value)} />
      </div>

      {layer.kind === "image" ? <div className="readonly-setting-note">
        <strong>图片设置保持固定</strong>
        <p>当前只允许调整图片槽位的位置与尺寸；素材、裁切方式和圆角暂不开放。</p>
      </div> : null}

      {layer.kind === "text" && layer.text ? <>
        <div className="inspector-group-heading"><span>文字表现</span><small>可调</small></div>
        <label className="form-field">
          <span>字体族</span>
          <input value={layer.text.fontFamily} onChange={(event) => amendText({ ...layer.text!, fontFamily: event.target.value })} />
        </label>
        <div className="coordinate-grid">
          <NumberControl label="字号" value={layer.text.fontSize} min={1} onChanged={(value) => amendText({ ...layer.text!, fontSize: value })} />
          <NumberControl label="字重" value={layer.text.fontWeight} min={100} max={1000} step={50} onChanged={(value) => amendText({ ...layer.text!, fontWeight: Math.round(value) })} />
          <NumberControl label="行高" value={layer.text.lineHeight} min={0.1} max={4} step={0.05} onChanged={(value) => amendText({ ...layer.text!, lineHeight: value })} />
          <NumberControl label="字距" value={layer.text.letterSpacing} min={-100} max={100} step={0.5} onChanged={(value) => amendText({ ...layer.text!, letterSpacing: value })} />
          <NumberControl label="最多行数" value={layer.text.maxLines} min={1} max={24} onChanged={(value) => amendText({ ...layer.text!, maxLines: Math.max(1, Math.round(value)) })} />
        </div>
        <ColorControl label="文字颜色" value={layer.text.color} onChanged={(value) => amendText({ ...layer.text!, color: value })} />
        {layer.text.accentColor ? <ColorControl label="重点文字颜色" value={layer.text.accentColor} onChanged={(value) => amendText({ ...layer.text!, accentColor: value })} /> : null}
        {layer.text.strokeColor ? <>
          <ColorControl label="文字描边颜色" value={layer.text.strokeColor} onChanged={(value) => amendText({ ...layer.text!, strokeColor: value })} />
          <NumberControl label="文字描边宽度" value={layer.text.strokeWidth ?? 0} min={0} max={100} step={0.25} onChanged={(value) => amendText({ ...layer.text!, strokeWidth: value })} />
        </> : null}
        {layer.text.shadow ? <>
          <div className="inspector-group-heading minor"><span>文字阴影</span><small>可调</small></div>
          <ColorControl label="阴影颜色" value={layer.text.shadow.color} onChanged={(value) => amendText({ ...layer.text!, shadow: { ...layer.text!.shadow!, color: value } })} />
          <div className="coordinate-grid">
            <NumberControl label="不透明度" value={layer.text.shadow.opacity} min={0} max={1} step={0.05} onChanged={(value) => amendText({ ...layer.text!, shadow: { ...layer.text!.shadow!, opacity: value } })} />
            <NumberControl label="模糊" value={layer.text.shadow.blur} min={0} max={100} step={0.25} onChanged={(value) => amendText({ ...layer.text!, shadow: { ...layer.text!.shadow!, blur: value } })} />
            <NumberControl label="水平偏移" value={layer.text.shadow.offsetX} min={-100} max={100} step={0.25} onChanged={(value) => amendText({ ...layer.text!, shadow: { ...layer.text!.shadow!, offsetX: value } })} />
            <NumberControl label="垂直偏移" value={layer.text.shadow.offsetY} min={-100} max={100} step={0.25} onChanged={(value) => amendText({ ...layer.text!, shadow: { ...layer.text!.shadow!, offsetY: value } })} />
          </div>
        </> : null}
        <label className="form-field">
          <span>文字对齐</span>
          <select value={layer.text.textAlign} onChange={(event) => amendText({ ...layer.text!, textAlign: event.target.value as TemplateDesignTextStyle["textAlign"] })}>
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select>
        </label>
      </> : null}

      {layer.surface ? <>
        <div className="inspector-group-heading"><span>表面样式</span><small>可调</small></div>
        {layer.surface.fill ? <ColorControl label="填充颜色" value={layer.surface.fill} onChanged={(value) => amendSurface({ ...layer.surface!, fill: value })} /> : null}
        {layer.surface.borderColor ? <ColorControl label="边框颜色" value={layer.surface.borderColor} onChanged={(value) => amendSurface({ ...layer.surface!, borderColor: value })} /> : null}
        <div className="coordinate-grid">
          {layer.surface.borderWidth !== undefined ? <NumberControl label="边框宽度" value={layer.surface.borderWidth} min={0} max={100} onChanged={(value) => amendSurface({ ...layer.surface!, borderWidth: value })} /> : null}
          {layer.surface.borderRadius !== undefined ? <NumberControl label="圆角" value={layer.surface.borderRadius} min={0} max={10000} onChanged={(value) => amendSurface({ ...layer.surface!, borderRadius: value })} /> : null}
          {layer.surface.opacity !== undefined ? <NumberControl label="不透明度" value={layer.surface.opacity} min={0} max={1} step={0.05} onChanged={(value) => amendSurface({ ...layer.surface!, opacity: value })} /> : null}
        </div>
      </> : null}
    </section>
  );
}

export function TemplateEffectDebugger(): ReactNode {

  const [persistedDesign, setPersistedDesign] = useState<VideoTemplateDesign>();
  const [design, setDesign] = useState<VideoTemplateDesign>();
  const [viewId, setViewId] = useState("");
  const [previewStateId, setPreviewStateId] = useState("");
  const [selectedLayerId, setSelectedLayerId] = useState<string>();
  const [dragState, setDragState] = useState<CanvasDragState>();
  const [guidesVisible, setGuidesVisible] = useState(false);
  const [feedback, setFeedback] = useState<TemplateDebuggerFeedback>(initialFeedback);
  const canvasReference = useRef<HTMLDivElement>(null);
  const canvasStageReference = useRef<HTMLDivElement>(null);
  const [canvasPreviewSize, setCanvasPreviewSize] = useState<TemplateCanvasPreviewSize>();

  const activeView = useMemo(() => design && viewId ? findTemplateView(design, viewId) : undefined, [design, viewId]);
  const activeExperience = useMemo(() => design ? presentCreationMethodExperience(design.creationMethodId) : undefined, [design]);
  const activePreviewState = useMemo(() => activeExperience?.previewStates.find((state) => state.id === previewStateId),
    [activeExperience, previewStateId]);
  const selectedLayer = useMemo(() => activeView && selectedLayerId ? findTemplateLayer(activeView, selectedLayerId) : undefined,
    [activeView, selectedLayerId]);
  const draftIsDirty = useMemo(() => resolveTemplateDebuggingDraftStatus(persistedDesign, design) === "draft",
    [design, persistedDesign]);
  const methodPresentation = useMemo(() => {
    if (!design || !activeView) return undefined;
    return presentIllustratedCaptionDebuggingState({
      state: previewStateId as IllustratedCaptionDebuggingStateId,
      canvas: activeView.canvas,
      episodeTitle: requireSampleValue(design, "episode.title"),
      seriesDisplayName: requireSampleValue(design, "series.display-name")
    });
  }, [activeView, design, previewStateId]);
  const visibleLayers = useMemo(() => {
    if (!activeView) return [];
    if (methodPresentation?.frameKind === "theme-card") {
      const chromeLayerIds = new Set(["account-mark", "account-name", "disclaimer", "footer"]);
      return activeView.layers.filter((layer) => chromeLayerIds.has(layer.id));
    }
    return activeView.layers;
  }, [activeView, methodPresentation]);

  const presentDraftChanged = (nextDesign: VideoTemplateDesign): void => {
    setDesign(nextDesign);
    setFeedback(resolveTemplateDebuggingDraftStatus(persistedDesign, nextDesign) === "draft"
      ? { tone: "neutral", message: "正在预览未保存的调整；保存后才会写回模板。" } : initialFeedback);
  };

  const openTemplateEffect = async (summary: TemplateDesignSummary): Promise<void> => {
    const response = await requestApi<TemplateResponse>(`/api/template-design?creationMethodId=${encodeURIComponent(summary.creationMethodId)}&templateId=${encodeURIComponent(summary.templateId)}`);
    setPersistedDesign(cloneTemplateDesign(response.design));
    setDesign(cloneTemplateDesign(response.design));
    setViewId(response.design.views[0]?.id ?? "");
    setPreviewStateId(presentCreationMethodExperience(response.design.creationMethodId).defaultPreviewStateId);
    setSelectedLayerId(undefined);
    setFeedback(initialFeedback);
  };

  useEffect(() => {
    const discoverTemplateEffect = async (): Promise<void> => {
      try {
        const templateResponse = await requestApi<TemplateListResponse>("/api/template-designs");
        if (!templateResponse.templates[0]) throw new Error("当前项目没有可调试模板。");
        await openTemplateEffect(templateResponse.templates[0]);
      } catch (error) {
        setFeedback({ tone: "error", message: error instanceof Error ? error.message : String(error) });
      }
    };
    void discoverTemplateEffect();
  }, []);

  useEffect(() => {
    if (!activeView || !canvasStageReference.current) return;
    const stage = canvasStageReference.current;
    const measureCanvasPreview = (): void => {
      const style = getComputedStyle(stage);
      const available = { width: stage.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight),
        height: stage.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom) };
      const nextSize = fitTemplateCanvasPreview(activeView.canvas, available);
      setCanvasPreviewSize((current) => current?.width === nextSize.width && current.height === nextSize.height ? current : nextSize);
    };
    measureCanvasPreview();
    const observer = new ResizeObserver(measureCanvasPreview);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [activeView?.canvas.height, activeView?.canvas.width, viewId]);

  useEffect(() => {
    if (!draftIsDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent): void => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [draftIsDirty]);

  useEffect(() => {
    if (!dragState || !design) return;
    const amendDrag = (event: PointerEvent): void => {
      if (event.pointerId !== dragState.pointerId) return;
      const deltaX = (event.clientX - dragState.startClientX) * dragState.canvas.width / dragState.canvasClientRect.width;
      const deltaY = (event.clientY - dragState.startClientY) * dragState.canvas.height / dragState.canvasClientRect.height;
      const rect = dragState.mode === "move"
        ? { ...dragState.startRect, x: dragState.startRect.x + deltaX, y: dragState.startRect.y + deltaY }
        : { ...dragState.startRect, width: dragState.startRect.width + deltaX, height: dragState.startRect.height + deltaY };
      const view = findTemplateView(design, dragState.viewId);
      const existing = findTemplateLayer(view, dragState.layerId);
      if (!existing) {
        console.warn(`[template-effect-debugger] dragged layer disappeared template=${design.id} layer=${dragState.layerId}.`);
        setDragState(undefined); return;
      }
      presentDraftChanged(amendLayerInDesign(design, view.id, existing.id,
        { ...existing, rect: constrainRect(rect, view.canvas) }));
    };
    const finishDrag = (event: PointerEvent): void => { if (event.pointerId === dragState.pointerId) setDragState(undefined); };
    window.addEventListener("pointermove", amendDrag); window.addEventListener("pointerup", finishDrag);
    return () => { window.removeEventListener("pointermove", amendDrag); window.removeEventListener("pointerup", finishDrag); };
  }, [design, dragState]);

  const beginLayerDrag = (event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>, layer: TemplateDesignLayer,
    mode: CanvasDragState["mode"]): void => {
    if (!activeView || !canvasReference.current) return;
    event.preventDefault(); event.stopPropagation(); setSelectedLayerId(layer.id);
    setDragState({ layerId: layer.id, viewId: activeView.id, mode, pointerId: event.pointerId,
      startClientX: event.clientX, startClientY: event.clientY, startRect: layer.rect,
      canvasClientRect: canvasReference.current.getBoundingClientRect(), canvas: activeView.canvas });
  };

  const moveLayerByKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>, layer: TemplateDesignLayer): void => {
    if (!design || !activeView || event.currentTarget !== event.target) return;
    const directionByKey = { ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up" } as const;
    const direction = directionByKey[event.key as keyof typeof directionByKey];
    if (!direction) return;
    event.preventDefault();
    const amendedLayer = { ...layer, rect: moveTemplateLayerWithKeyboard(layer.rect, activeView.canvas,
      { direction, step: event.shiftKey ? 10 : 1 }) };
    setSelectedLayerId(layer.id);
    presentDraftChanged(amendLayerInDesign(design, activeView.id, layer.id, amendedLayer));
  };

  const restorePersistedEffect = (): void => {
    if (!persistedDesign) return;
    setDesign(cloneTemplateDesign(persistedDesign)); setSelectedLayerId(undefined); setDragState(undefined);
    setFeedback({ tone: "success", message: "已恢复到最近一次保存的模板效果。" });
  };
  const persistTemplateEffect = async (): Promise<void> => {
    if (!design || !draftIsDirty) return;
    try {
      setFeedback({ tone: "saving", message: "正在校验并保存调试结果…" });
      const response = await requestApi<TemplateResponse>("/api/template-design", { method: "PUT",
        body: { creationMethodId: design.creationMethodId, templateId: design.id, design } });
      setPersistedDesign(cloneTemplateDesign(response.design)); setDesign(cloneTemplateDesign(response.design));
      setFeedback({ tone: "success", message: "调试结果已保存，后续合成会读取这些值。" });
    } catch (error) { setFeedback({ tone: "error", message: error instanceof Error ? error.message : String(error) }); }
  };

  return <main className="debugger-shell">
    <header className="debugger-header"><div className="header-copy"><p className="eyebrow">KNOWLEDGE-EXPLAINER · TEMPLATE EFFECT</p>
      <h1>{activeExperience?.displayName ?? "模板效果调试器"}</h1><p>{activeExperience?.shortDescription}</p></div>
      <div className="header-actions"><div className={`draft-status ${draftIsDirty ? "dirty" : "saved"}`}><span />
        {draftIsDirty ? "有未保存调整" : "与已保存值一致"}</div><span className={`feedback-chip ${feedback.tone}`}>{feedback.message}</span>
        <button className="secondary-button" disabled={!draftIsDirty} onClick={restorePersistedEffect}>恢复已保存值</button>
        <button className="save-button" disabled={!draftIsDirty} onClick={() => void persistTemplateEffect()}>保存调试结果</button></div></header>
    <div className="debugger-grid">
      <aside className="left-sidebar"><section className="sidebar-section method-overview"><div className="section-heading"><span>创作方法</span></div>
        <strong>{activeExperience?.exampleTitle}</strong><p className="helper-text">{activeExperience?.exampleSummary}</p></section>
        <section className="sidebar-section sample-data-section"><div className="section-heading"><span>样例内容</span>
          <small>{design?.fields.length ?? 0} 个固定字段</small></div><div className="sample-field-list">
          {design?.fields.map((field) => <SampleFieldEditor key={field.id} creationMethodId={design.creationMethodId}
            field={field} onSampleChanged={(sampleValue) => presentDraftChanged(amendFieldSampleInDesign(design, field.id, sampleValue))} />)}
        </div></section></aside>
      <section className="canvas-panel"><div className="canvas-toolbar"><div className="canvas-heading"><span>{activePreviewState?.displayName}</span>
        <strong>{design?.displayName ?? "模板效果"}</strong></div><div className="canvas-controls"><label className="guide-toggle">
        <input type="checkbox" checked={guidesVisible} onChange={(event) => setGuidesVisible(event.target.checked)} /><span />显示调试辅助线</label>
        <label className="view-picker state-picker"><span>演示状态</span><select value={previewStateId}
          onChange={(event) => { setPreviewStateId(event.target.value); setSelectedLayerId(undefined); }}>
          {activeExperience?.previewStates.map((state) => <option key={state.id} value={state.id}>{state.displayName}</option>)}</select></label>
        <label className="view-picker"><span>画幅</span><select value={viewId}
          onChange={(event) => { setViewId(event.target.value); setSelectedLayerId(undefined); }}>
          {design?.views.map((view) => <option key={view.id} value={view.id}>{view.displayName}</option>)}</select></label></div></div>
        <div ref={canvasStageReference} className="canvas-stage">{activeView && design ? <div className="template-canvas-wrap">
          <div className="template-canvas-viewport" style={{ width: canvasPreviewSize?.width ?? 0, height: canvasPreviewSize?.height ?? 0 }}>
            <div ref={canvasReference} className={`template-canvas debugger-canvas ${guidesVisible ? "guides-visible" : ""}`}
              data-method-id={design.creationMethodId} data-view-id={activeView.id} data-preview-state={previewStateId}
              style={templateCanvasDebuggerStyle(activeView.canvas, canvasPreviewSize)}>
              {guidesVisible ? <div className="safe-area" style={{ left: activeView.safeArea.left, top: activeView.safeArea.top,
                right: activeView.safeArea.right, bottom: activeView.safeArea.bottom }} /> : null}
              {visibleLayers.slice().sort((left, right) => left.zIndex - right.zIndex).map((layer) => <div key={layer.id}
                className={`canvas-layer ${layer.kind} ${selectedLayerId === layer.id ? "selected" : ""}`}
                role="group" tabIndex={0} style={templateLayerStyle(layer)} onFocus={() => setSelectedLayerId(layer.id)}
                onKeyDown={(event) => moveLayerByKeyboard(event, layer)} onPointerDown={(event) => beginLayerDrag(event, layer, "move")}>
                {guidesVisible ? <div className="layer-label">{layer.displayName}</div> : null}
                <div className="layer-content"><LayerPreview design={design} layer={layer} /></div>
                <button className="resize-handle" aria-label={`缩放${layer.displayName}`}
                  onPointerDown={(event) => beginLayerDrag(event, layer, "resize")} /></div>)}
              {methodPresentation ? <KnowledgeThemeCardCasePreview design={design} view={activeView}
                    presentation={methodPresentation} /> : null}
            </div><div className="canvas-status-badge"><span />{activePreviewState?.displayName} · {guidesVisible ? "辅助线已显示" : "干净预览"}</div>
          </div></div> : <div className="empty-canvas">正在读取模板效果…</div>}</div>
        <footer className="canvas-help"><span>拖动调整位置</span><span>右下角调整尺寸</span><span>方向键微调</span></footer></section>
      <aside className="right-sidebar">{design && activeView && selectedLayer ? <LayerInspector design={design} view={activeView}
        layer={selectedLayer} onLayerChanged={(layer) => presentDraftChanged(amendLayerInDesign(design, activeView.id, layer.id, layer))}
        onClosed={() => setSelectedLayerId(undefined)} /> : null}
        {design && activeView && activeExperience && !selectedLayer
          ? <CaseContractOverview design={design} experience={activeExperience} view={activeView} /> : null}</aside>
    </div>
  </main>;
}
