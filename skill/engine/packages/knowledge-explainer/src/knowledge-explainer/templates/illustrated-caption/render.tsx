import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig
} from "remotion";
import {
  type KnowledgeExplainerTemplateColorToken,
  type KnowledgeExplainerTemplateModule,
  type KnowledgeExplainerVideoTemplate,
  type KnowledgeExplainerProductionLock,
  type KnowledgeExplainerScene,
  type KnowledgeExplainerIdentity,
  type KnowledgeExplainerThemeCard,
  type ResolvedKnowledgeExplainerIllustration
} from "@knowledge-explainer/contracts";
import {
  getKnowledgeExplainerTemplateModule,
  getKnowledgeExplainerVideoTemplate,
  getThemePack,
  type ThemePack
} from "./definition";
import { resolveKnowledgeExplainerThemeCardLayout } from "./debugging-presentation";

export type KnowledgeExplainerVideoProps = {
  project: KnowledgeExplainerProductionLock;
};

type KnowledgeExplainerChromeProps = {
  identity: KnowledgeExplainerIdentity;
  template: KnowledgeExplainerVideoTemplate;
  theme: ThemePack;
  scale: number;
  showEpisodeTitle?: boolean;
};

type KnowledgeExplainerSceneState = {
  scene: KnowledgeExplainerScene;
  visibility: number;
};

type KnowledgeExplainerIllustrationState = {
  illustration: ResolvedKnowledgeExplainerIllustration;
  visibility: number;
};

function resolveKnowledgeExplainerIdentity(project: KnowledgeExplainerProductionLock): KnowledgeExplainerIdentity {
  return project.knowledgeExplainer;
}

function resolveKnowledgeExplainerSceneState(
  project: KnowledgeExplainerProductionLock,
  frame: number
): KnowledgeExplainerSceneState {
  const scene = project.scenes.find(
    (candidate) => frame >= candidate.startFrame && frame < candidate.endFrame
  );
  if (!scene) {
    throw new Error(`Cannot resolve knowledge explainer scene for frame ${frame}.`);
  }
  if (!scene.illustration) {
    throw new Error(`Knowledge explainer scene ${scene.id} is missing a generated illustration contract.`);
  }
  const entry = interpolate(frame, [scene.startFrame, scene.startFrame + 4], [0, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const exit = interpolate(frame, [scene.endFrame - 3, scene.endFrame], [1, 0], {
    easing: Easing.in(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  return { scene, visibility: Math.min(entry, exit) };
}

function resolveKnowledgeExplainerIllustrationState(
  project: KnowledgeExplainerProductionLock,
  captionScene: KnowledgeExplainerScene,
  frame: number
): KnowledgeExplainerIllustrationState {
  const cueId = captionScene.illustrationCueId ?? captionScene.id;
  const cue = project.illustrationCues?.find(
    (candidate) => candidate.id === cueId && frame >= candidate.startFrame && frame < candidate.endFrame
  );
  const illustration = cue?.illustration ?? captionScene.illustration;
  const startFrame = cue?.startFrame ?? captionScene.startFrame;
  const endFrame = cue?.endFrame ?? captionScene.endFrame;
  const entry = interpolate(frame, [startFrame, startFrame + 4], [0, 1], {
    easing: Easing.out(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const exit = interpolate(frame, [endFrame - 3, endFrame], [1, 0], {
    easing: Easing.in(Easing.quad),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  return { illustration, visibility: Math.min(entry, exit) };
}

function resolveTemplateColor(
  token: KnowledgeExplainerTemplateColorToken | undefined,
  explicitColor: string | undefined,
  theme: ThemePack
): string {
  return explicitColor ?? (token ? theme.tokens[token] : theme.tokens.ink);
}

function absoluteModuleStyle(module: KnowledgeExplainerTemplateModule, scale: number): CSSProperties {
  return {
    position: "absolute",
    left: module.rect.x * scale,
    top: module.rect.y * scale,
    width: module.rect.width * scale,
    height: module.rect.height * scale
  };
}

function moduleTextStyle(
  module: KnowledgeExplainerTemplateModule,
  theme: ThemePack,
  scale: number
): CSSProperties {
  if (!module.text) {
    throw new Error(`KnowledgeExplainer template module ${module.id} has no text style.`);
  }
  return {
    color: resolveTemplateColor(module.text.colorToken, module.color, theme),
    fontFamily: module.text.fontFamily,
    fontSize: module.text.fontSize * scale,
    fontWeight: module.text.fontWeight,
    lineHeight: module.text.lineHeight,
    letterSpacing: module.text.letterSpacing * scale,
    textAlign: module.text.textAlign,
    whiteSpace: module.text.whiteSpace
  };
}

function KnowledgeExplainerChrome(props: KnowledgeExplainerChromeProps): ReactNode {
  const { identity, template, theme, scale, showEpisodeTitle = true } = props;
  const accountMark = getKnowledgeExplainerTemplateModule(template, "account-mark");
  const accountName = getKnowledgeExplainerTemplateModule(template, "account-name");
  const episodeTitle = getKnowledgeExplainerTemplateModule(template, "episode-title");
  const disclaimer = getKnowledgeExplainerTemplateModule(template, "disclaimer");
  const footer = getKnowledgeExplainerTemplateModule(template, "footer");
  if (!accountMark.border || !footer.footer || !footer.border) {
    throw new Error(`KnowledgeExplainer template ${template.id} is missing required account mark or footer contracts.`);
  }

  return (
    <>
      <div
        style={{
          ...absoluteModuleStyle(accountMark, scale),
          ...moduleTextStyle(accountMark, theme, scale),
          border: `${accountMark.border.width * scale}px solid ${resolveTemplateColor(accountMark.border.colorToken, accountMark.border.color, theme)}`,
          borderRadius: accountMark.border.radius * scale,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {identity.accountMarkText}
      </div>
      <div style={{ ...absoluteModuleStyle(accountName, scale), ...moduleTextStyle(accountName, theme, scale) }}>
        {identity.accountName}
      </div>
      {showEpisodeTitle ? (
        <div
          style={{
            ...absoluteModuleStyle(episodeTitle, scale),
            ...moduleTextStyle(episodeTitle, theme, scale),
            overflow: "hidden"
          }}
        >
          {identity.episodeTitle}
        </div>
      ) : null}
      <div style={{ ...absoluteModuleStyle(disclaimer, scale), ...moduleTextStyle(disclaimer, theme, scale) }}>
        {identity.disclaimer}
      </div>
      <div
        style={{
          ...absoluteModuleStyle(footer, scale),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: resolveTemplateColor(footer.backgroundToken, footer.backgroundColor, theme),
          ...moduleTextStyle(footer, theme, scale)
        }}
      >
        {identity.footerColumns.map((column, index) => (
          <div
            key={`${column.topLine}-${column.bottomLine}`}
            style={{
              width: footer.footer!.columnWidth * scale,
              height: footer.footer!.contentHeight * scale,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRight: index < identity.footerColumns.length - 1
                ? `${footer.footer!.dividerWidth * scale}px solid ${resolveTemplateColor(footer.border!.colorToken, footer.border!.color, theme)}`
                : undefined
            }}
          >
            <span>{column.topLine}</span>
            <span>{column.bottomLine}</span>
          </div>
        ))}
      </div>
    </>
  );
}

type KnowledgeExplainerThemeCardProps = {
  card: KnowledgeExplainerThemeCard;
  identity: KnowledgeExplainerIdentity;
  template: KnowledgeExplainerVideoTemplate;
  theme: ThemePack;
  scale: number;
  closing: boolean;
};

/**
 * 用同一套品牌框架承载每期主题。首帧直接完整呈现，不做淡入；
 * 尾帧保持到成片最后一帧，确保平台抽帧时始终能识别主题。
 */
function KnowledgeExplainerThemeCardView(props: KnowledgeExplainerThemeCardProps): ReactNode {
  const { card, identity, template, theme, scale, closing } = props;
  const layout = resolveKnowledgeExplainerThemeCardLayout(
    template.canvas,
    card.primaryTitle,
    card.emphasisTitle
  );
  const illustration = getKnowledgeExplainerTemplateModule(template, "illustration");

  return (
    <>
      <KnowledgeExplainerChrome
        identity={identity}
        template={template}
        theme={theme}
        scale={scale}
        showEpisodeTitle={false}
      />
      <div
        style={{
          position: "absolute",
          left: layout.titleLeft * scale,
          top: layout.eyebrowTop * scale,
          width: layout.titleWidth * scale,
          color: theme.tokens.mutedInk,
          fontFamily: "PingFang SC, Noto Sans CJK SC, Hiragino Sans GB, sans-serif",
          fontSize: 40 * scale,
          fontWeight: 500,
          letterSpacing: 3 * scale,
          textAlign: "center"
        }}
      >
        {closing ? `本期回看 · ${card.eyebrow}` : card.eyebrow}
      </div>
      <div
        style={{
          position: "absolute",
          left: layout.ruleLeft * scale,
          top: layout.ruleTop * scale,
          width: layout.ruleWidth * scale,
          height: 1.5 * scale,
          background: theme.tokens.mutedInk
        }}
      />
      <div
        style={{
          position: "absolute",
          left: layout.titleLeft * scale,
          top: layout.primaryTop * scale,
          width: layout.titleWidth * scale,
          minHeight: 130 * scale,
          color: theme.tokens.ink,
          fontFamily: "PingFang SC, Noto Sans CJK SC, Hiragino Sans GB, sans-serif",
          fontSize: layout.primaryTitleFontSize * scale,
          fontWeight: 900,
          lineHeight: 1.08,
          letterSpacing: -1 * scale,
          textAlign: "center",
          whiteSpace: "nowrap"
        }}
      >
        {card.primaryTitle}
      </div>
      <div
        style={{
          position: "absolute",
          left: layout.titleLeft * scale,
          top: layout.emphasisTop * scale,
          width: layout.titleWidth * scale,
          minHeight: 130 * scale,
          color: theme.tokens.accent,
          fontFamily: "PingFang SC, Noto Sans CJK SC, Hiragino Sans GB, sans-serif",
          fontSize: layout.emphasisTitleFontSize * scale,
          fontWeight: 900,
          lineHeight: 1.08,
          letterSpacing: -1 * scale,
          textAlign: "center",
          whiteSpace: "nowrap"
        }}
      >
        {card.emphasisTitle}
      </div>
      <div
        style={{
          position: "absolute",
          left: 120 * scale,
          top: layout.illustrationTop * scale,
          width: 840 * scale,
          height: layout.illustrationHeight * scale,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Img
          src={staticFile(card.illustration.assetPath)}
          style={{ width: "100%", height: "100%", objectFit: illustration.image?.objectFit ?? "contain" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 120 * scale,
          top: layout.signatureTop * scale,
          width: 840 * scale,
          color: theme.tokens.mutedInk,
          fontFamily: "PingFang SC, Helvetica Neue, Hiragino Sans GB, sans-serif",
          fontSize: 34 * scale,
          fontWeight: 300,
          letterSpacing: 6 * scale,
          textAlign: "center"
        }}
      >
        {identity.signatureLine}
      </div>
    </>
  );
}

export function KnowledgeExplainerVideo(props: KnowledgeExplainerVideoProps): ReactNode {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const identity = resolveKnowledgeExplainerIdentity(props.project);
  const template = getKnowledgeExplainerVideoTemplate(props.project.templateId, props.project.view.id);
  const theme = getThemePack(props.project.themeId as ThemePack["id"]);
  const caption = getKnowledgeExplainerTemplateModule(template, "caption");
  const signature = getKnowledgeExplainerTemplateModule(template, "signature");
  const illustration = getKnowledgeExplainerTemplateModule(template, "illustration");
  const scale = Math.min(width / template.canvas.width, height / template.canvas.height);
  const horizontalOffset = (width - template.canvas.width * scale) / 2;
  const verticalOffset = (height - template.canvas.height * scale) / 2;
  const isThemeCover = frame < props.project.framing.introDurationInFrames;
  const closingStartFrame = props.project.durationInFrames - props.project.framing.outroDurationInFrames;
  const isThemeClosing = frame >= closingStartFrame;
  const sceneState = isThemeCover || isThemeClosing
    ? undefined
    : resolveKnowledgeExplainerSceneState(props.project, frame);
  const illustrationState = sceneState
    ? resolveKnowledgeExplainerIllustrationState(props.project, sceneState.scene, frame)
    : undefined;
  const captionEntranceOffset = sceneState
    ? interpolate(sceneState.visibility, [0, 1], [13 * scale, 0])
    : 0;
  const illustrationEntranceOffset = illustrationState
    ? interpolate(illustrationState.visibility, [0, 1], [10 * scale, 0])
    : 0;
  const backgroundColor = identity.background.color ?? theme.tokens.canvas;
  const backgroundMusic = identity.backgroundMusic.assetPath;
  const isStudioPreview = props.project.narration.timingSource === "preview";

  return (
    <AbsoluteFill style={{ background: backgroundColor, overflow: "hidden" }}>
      {!isStudioPreview ? (
        <Sequence from={props.project.framing.introDurationInFrames} premountFor={props.project.format.fps}>
          <Audio src={staticFile(props.project.narration.audioPath)} volume={0.98} />
        </Sequence>
      ) : null}
      {!isStudioPreview && backgroundMusic ? (
        <Audio
          src={staticFile(backgroundMusic)}
          loop={identity.backgroundMusic.loop}
          volume={identity.backgroundMusic.volume}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: horizontalOffset,
          top: verticalOffset,
          width: template.canvas.width * scale,
          height: template.canvas.height * scale,
          overflow: "hidden",
          background: backgroundColor
        }}
      >
        {isThemeCover || isThemeClosing ? (
          <KnowledgeExplainerThemeCardView
            card={isThemeCover ? props.project.framing.cover : props.project.framing.closing}
            identity={identity}
            template={template}
            theme={theme}
            scale={scale}
            closing={isThemeClosing}
          />
        ) : sceneState && illustrationState ? (
          <>
            <KnowledgeExplainerChrome identity={identity} template={template} theme={theme} scale={scale} />
            <div
              style={{
                ...absoluteModuleStyle(caption, scale),
                ...moduleTextStyle(caption, theme, scale),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: sceneState.visibility,
                transform: `translateY(${captionEntranceOffset}px)`
              }}
            >
              {sceneState.scene.headline}
            </div>
            <div style={{ ...absoluteModuleStyle(signature, scale), ...moduleTextStyle(signature, theme, scale) }}>
              {identity.signatureLine}
            </div>
            <div
              style={{
                ...absoluteModuleStyle(illustration, scale),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: illustrationState.visibility,
                transform: `translateY(${illustrationEntranceOffset}px)`
              }}
            >
              <Img
                src={staticFile(illustrationState.illustration.assetPath)}
                style={{ width: "100%", height: "100%", objectFit: illustration.image?.objectFit ?? "contain" }}
              />
            </div>
          </>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
