import type { CanvasFormat, KnowledgeExplainerFooterColumn } from "@knowledge-explainer/contracts";
import {
  resolveKnowledgeExplainerCoverTitle,
  resolveKnowledgeExplainerThemeTitleFontSize
} from "./cover-title";

export type IllustratedCaptionDebuggingStateId =
  | "theme-cover"
  | "content"
  | "theme-closing";

export type KnowledgeExplainerThemeCardLayout = {
  eyebrowTop: number;
  ruleTop: number;
  ruleLeft: number;
  ruleWidth: number;
  primaryTop: number;
  emphasisTop: number;
  signatureTop: number;
  illustrationTop: number;
  illustrationHeight: number;
  titleLeft: number;
  titleWidth: number;
  primaryTitleFontSize: number;
  emphasisTitleFontSize: number;
};

export type IllustratedCaptionDebuggingRequest = {
  state: IllustratedCaptionDebuggingStateId;
  canvas: CanvasFormat;
  episodeTitle: string;
  seriesDisplayName: string;
};

export type IllustratedCaptionDebuggingPresentation = {
  state: IllustratedCaptionDebuggingStateId;
  frameKind: "content" | "theme-card";
  eyebrow?: string;
  primaryTitle?: string;
  emphasisTitle?: string;
  layout?: KnowledgeExplainerThemeCardLayout;
};

export function resolveKnowledgeExplainerThemeCardLayout(
  canvas: CanvasFormat,
  primaryTitle: string,
  emphasisTitle: string
): KnowledgeExplainerThemeCardLayout {
  const compactFrame = canvas.height <= 1440;
  const titleWidth = 1000;
  return {
    eyebrowTop: compactFrame ? 252 : 328,
    ruleTop: compactFrame ? 309 : 390,
    ruleLeft: 300,
    ruleWidth: 480,
    primaryTop: compactFrame ? 350 : 430,
    emphasisTop: compactFrame ? 490 : 610,
    signatureTop: compactFrame ? 620 : 775,
    illustrationTop: compactFrame ? 700 : 900,
    illustrationHeight: compactFrame ? 430 : 590,
    titleLeft: (canvas.width - titleWidth) / 2,
    titleWidth,
    primaryTitleFontSize: resolveKnowledgeExplainerThemeTitleFontSize(primaryTitle),
    emphasisTitleFontSize: resolveKnowledgeExplainerThemeTitleFontSize(emphasisTitle)
  };
}

/** 把正式封面分层和收束页眉题转换成调试器可切换的代表性状态。 */
export function presentIllustratedCaptionDebuggingState(
  request: IllustratedCaptionDebuggingRequest
): IllustratedCaptionDebuggingPresentation {
  if (request.state === "content") {
    return { state: "content", frameKind: "content" };
  }
  const title = resolveKnowledgeExplainerCoverTitle(request.episodeTitle);
  return {
    state: request.state,
    frameKind: "theme-card",
    eyebrow: request.state === "theme-closing"
      ? `本期回看 · ${request.seriesDisplayName}`
      : request.seriesDisplayName,
    ...title,
    layout: resolveKnowledgeExplainerThemeCardLayout(
      request.canvas,
      title.primaryTitle,
      title.emphasisTitle
    )
  };
}

/** 富文本样例严格使用“栏间｜、栏内换行”，对应正式账号的三组定位标签。 */
export function presentKnowledgeExplainerFooterColumns(
  sampleValue: string
): KnowledgeExplainerFooterColumn[] {
  const columns = sampleValue.split("｜").map((column) => {
    const lines = column.split("\n").map((line) => line.trim()).filter(Boolean);
    return lines.length === 2
      ? { topLine: lines[0]!, bottomLine: lines[1]! }
      : undefined;
  });
  if (columns.length !== 3 || columns.some((column) => column === undefined)) {
    throw new Error("知识讲解页脚样例必须是三栏两行。使用换行分隔栏内文字，使用｜分隔三栏。");
  }
  return columns as KnowledgeExplainerFooterColumn[];
}
