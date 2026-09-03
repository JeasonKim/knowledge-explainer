import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  KnowledgeExplainerIllustrationCatalogSchema,
  KnowledgeExplainerAccountProfileSchema,
  KnowledgeExplainerMediaCatalogSchema,
  CartesiaConfigSchema,
  CartesiaPronunciationCatalogSchema,
  KnowledgeExplainerCreationPlanSchema,
  KnowledgeExplainerProductionLockSchema,
  SubjectAssetCatalogSchema,
  NarrationTimingMapSchema,
  TtsCatalogSchema,
  VolcengineTtsConfigSchema,
  type KnowledgeExplainerAccountProfile,
  type KnowledgeExplainerIllustrationCatalog,
  type KnowledgeExplainerMediaCatalog,
  type CartesiaConfig,
  type CartesiaPronunciationCatalog,
  type KnowledgeExplainerCreationPlan,
  type KnowledgeExplainerProductionLock,
  type SubjectAssetCatalog,
  type NarrationSynthesisSettings,
  type NarrationTimingMap,
  type TtsCatalog,
  type TtsVoiceLanguage,
  type KnowledgeExplainerViewId,
  type VolcengineTtsConfig
} from "@knowledge-explainer/contracts";
import {
  composeKnowledgeExplainerProduction,
  createKnowledgeExplainerNarrationScript,
  resolveKnowledgeExplainerNarrationPlan,
  describeKnowledgeExplainerTemplate,
  planKnowledgeExplainerInspectionFrames,
  validateKnowledgeExplainerProduction,
  type KnowledgeExplainerNarrationPlan
} from "@knowledge-explainer/core";
import { assertNarrationAssetsSynchronized, createLocalForcedAlignmentTimingMap,
  createProportionalNarrationTimingMap } from "@knowledge-explainer/narration";
import { CartesiaTtsGateway, CartesiaPronunciationDictionaryGateway, MacosSayTtsGateway,
  VolcengineTtsGateway, chooseNarrationVoice, type NarrationAudioFormat,
  type NarrationSynthesisResult, type NarrationSynthesisSegment, type NarrationVoiceChoice,
  type TtsGateway } from "@knowledge-explainer/tts";
import { parseWhisperTranscriptionTokens } from "./parse-whisper-transcription";
import { resolveLocalAsrRuntime } from "./resolve-local-asr-runtime";
import { resolvePublicProductionAsset } from "./resolve-public-production-asset";
import { shouldApplyProjectQualityGate } from "./resolve-project-quality-gate";
import { resolveEnginePath, workspaceAssetsRoot } from "./runtime-paths";

type CliCommand = "compose-knowledge-explainer" | "synthesize-knowledge-explainer" | "align-knowledge-explainer"
  | "describe-knowledge-explainer" | "list-voices" | "list-pronunciations" | "list-subjects"
  | "validate" | "render" | "inspect" | "verify";
type CliRequest = { command: CliCommand; projectPath: string; accountPath?: string; planPath?: string;
  audioPath?: string; seriesId?: string; outputPath?: string; outputDirectory?: string; videoPath?: string;
  voiceCatalogPath?: string; cartesiaConfigPath?: string; volcengineConfigPath?: string; mediaCatalogPath?: string;
  illustrationCatalogPath?: string; pronunciationCatalogPath?: string; subjectCatalogPath?: string; model?: string;
  timingMapPath?: string; whisperBinaryPath?: string; whisperModelPath?: string; viewId?: string;
  minimumAlignmentRatio?: number; preview: boolean; seed?: number; };
type ChildCommand = { executable: string; arguments: string[]; };
type VisualAssetReference = { ownerId: string; ownerType: "board" | "scene"; assetPath: string; expectedSha256?: string; };
type NarrationSynthesisSetup = { audioFormat: NarrationAudioFormat; gateway: TtsGateway; model: string;
  voiceChoice: NarrationVoiceChoice; language: TtsVoiceLanguage; };
type NarrationSynthesisOutput = { result: NarrationSynthesisResult; timingMap?: NarrationTimingMap; };
type NarrationSynthesisPlan = { language: TtsVoiceLanguage; voiceProfileId: string; synthesis: NarrationSynthesisSettings; };
type NarrationProductionSource = { episodeId: string; language: TtsVoiceLanguage; script: string; beats: NarrationProductionBeat[]; };
type NarrationProductionBeat = { id: string; text: string; };
type ProjectProduction = KnowledgeExplainerProductionLock;

const CLI_COMMANDS = new Set<CliCommand>([
  "compose-knowledge-explainer", "synthesize-knowledge-explainer", "align-knowledge-explainer", "describe-knowledge-explainer",
  "list-voices", "list-pronunciations", "list-subjects", "validate", "render", "inspect", "verify"
]);

function readFlag(argumentsList: string[], flag: string): string | undefined {
  const flagIndex = argumentsList.indexOf(flag);
  return flagIndex >= 0 ? argumentsList[flagIndex + 1] : undefined;
}

function parseCliRequest(argumentsList: string[]): CliRequest {
  const requestedCommand = argumentsList[0] as CliCommand | undefined;
  if (!requestedCommand || !CLI_COMMANDS.has(requestedCommand)) {
    throw new Error(`Expected one of: ${[...CLI_COMMANDS].join(", ")}.`);
  }
  const request: CliRequest = {
    command: requestedCommand,
    projectPath: readFlag(argumentsList, "--project") ?? "",
    accountPath: readFlag(argumentsList, "--account"), planPath: readFlag(argumentsList, "--plan"),
    audioPath: readFlag(argumentsList, "--audio"), seriesId: readFlag(argumentsList, "--series"),
    outputPath: readFlag(argumentsList, "--output"), outputDirectory: readFlag(argumentsList, "--output-dir"),
    videoPath: readFlag(argumentsList, "--video"), voiceCatalogPath: readFlag(argumentsList, "--voice-catalog"),
    cartesiaConfigPath: readFlag(argumentsList, "--cartesia-config"), volcengineConfigPath: readFlag(argumentsList, "--volcengine-config"),
    mediaCatalogPath: readFlag(argumentsList, "--media-catalog"), illustrationCatalogPath: readFlag(argumentsList, "--illustration-catalog"),
    pronunciationCatalogPath: readFlag(argumentsList, "--pronunciation-catalog"), subjectCatalogPath: readFlag(argumentsList, "--subject-catalog"),
    model: readFlag(argumentsList, "--model"), timingMapPath: readFlag(argumentsList, "--timing-map"),
    whisperBinaryPath: readFlag(argumentsList, "--whisper-binary"), whisperModelPath: readFlag(argumentsList, "--whisper-model"),
    viewId: readFlag(argumentsList, "--view"), preview: argumentsList.includes("--preview")
  };
  const requestedSeed = readFlag(argumentsList, "--seed");
  request.seed = requestedSeed ? Number(requestedSeed) : undefined;
  const requestedMinimumAlignmentRatio = readFlag(argumentsList, "--minimum-alignment-ratio");
  request.minimumAlignmentRatio = requestedMinimumAlignmentRatio ? Number(requestedMinimumAlignmentRatio) : undefined;
  if (request.seed !== undefined && !Number.isInteger(request.seed)) throw new Error("Expected --seed to be an integer.");
  if (request.minimumAlignmentRatio !== undefined && (!Number.isFinite(request.minimumAlignmentRatio)
    || request.minimumAlignmentRatio <= 0 || request.minimumAlignmentRatio > 1)) {
    throw new Error("Expected --minimum-alignment-ratio within (0, 1].");
  }
  if (requestedCommand === "compose-knowledge-explainer" && (!request.accountPath || !request.planPath || !request.audioPath
    || !request.outputPath || (!request.timingMapPath && !request.preview))) {
    throw new Error("Compose requires --account, --plan, --audio, --timing-map, and --output.");
  }
  if (requestedCommand === "synthesize-knowledge-explainer" && (!request.accountPath || !request.planPath || !request.outputPath)) {
    throw new Error("Synthesize requires --account, --plan, and --output.");
  }
  if (requestedCommand === "align-knowledge-explainer" && (!request.planPath || !request.audioPath || !request.outputPath)) {
    throw new Error("Align requires --plan, --audio, and --output.");
  }
  if (requestedCommand === "describe-knowledge-explainer" && (!request.accountPath || !request.seriesId)) {
    throw new Error("Describe requires --account and --series.");
  }
  if (!["compose-knowledge-explainer", "synthesize-knowledge-explainer"].includes(requestedCommand) && request.timingMapPath) {
    throw new Error("--timing-map is only supported by compose and synthesize commands.");
  }
  if (request.preview && requestedCommand !== "compose-knowledge-explainer") {
    throw new Error("--preview is not supported by this command.");
  }
  if ((requestedCommand === "inspect" || requestedCommand === "verify") && !request.outputDirectory) {
    throw new Error("Inspect and verify require --output-dir.");
  }
  if ((requestedCommand === "render" || requestedCommand === "verify") && !request.outputPath) {
    throw new Error("Render and verify require --output.");
  }
  if (!["compose-knowledge-explainer", "synthesize-knowledge-explainer", "align-knowledge-explainer", "describe-knowledge-explainer",
    "list-voices", "list-pronunciations", "list-subjects"].includes(requestedCommand) && !request.projectPath) {
    throw new Error("Expected --project <production.json>.");
  }
  return request;
}

function contractErrorDetails(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

function parseStructuredData(path: string, source: string): unknown {
  return /\.ya?ml$/i.test(path) ? parseYaml(source) : JSON.parse(source);
}

async function loadKnowledgeExplainerAccountProfile(accountPath: string): Promise<KnowledgeExplainerAccountProfile> {
  const accountText = await readFile(accountPath, "utf8");
  const parsedAccount = KnowledgeExplainerAccountProfileSchema.safeParse(parseStructuredData(accountPath, accountText));
  if (!parsedAccount.success) {
    throw new Error(`KnowledgeExplainer account contract is invalid: ${contractErrorDetails(parsedAccount.error.issues)}`);
  }
  return parsedAccount.data;
}

async function loadKnowledgeExplainerCreationPlan(planPath: string): Promise<KnowledgeExplainerCreationPlan> {
  const planText = await readFile(planPath, "utf8");
  const parsedPlan = KnowledgeExplainerCreationPlanSchema.safeParse(parseStructuredData(planPath, planText));
  if (!parsedPlan.success) {
    throw new Error(`KnowledgeExplainer plan is invalid: ${contractErrorDetails(parsedPlan.error.issues)}`);
  }
  return parsedPlan.data;
}

async function loadKnowledgeExplainerMediaCatalog(catalogPath: string): Promise<KnowledgeExplainerMediaCatalog> {
  const catalogText = await readFile(catalogPath, "utf8");
  const parsedCatalog = KnowledgeExplainerMediaCatalogSchema.safeParse(parseStructuredData(catalogPath, catalogText));
  if (!parsedCatalog.success) {
    throw new Error(`KnowledgeExplainer media catalog is invalid: ${contractErrorDetails(parsedCatalog.error.issues)}`);
  }
  return parsedCatalog.data;
}

async function loadKnowledgeExplainerIllustrationCatalog(catalogPath: string): Promise<KnowledgeExplainerIllustrationCatalog> {
  const catalogText = await readFile(catalogPath, "utf8");
  const parsedCatalog = KnowledgeExplainerIllustrationCatalogSchema.safeParse(parseStructuredData(catalogPath, catalogText));
  if (!parsedCatalog.success) {
    throw new Error(`KnowledgeExplainer illustration catalog is invalid: ${contractErrorDetails(parsedCatalog.error.issues)}`);
  }
  return parsedCatalog.data;
}

async function loadNarrationTimingMap(timingMapPath: string): Promise<NarrationTimingMap> {
  const timingMapText = await readFile(timingMapPath, "utf8");
  const parsedTimingMap = NarrationTimingMapSchema.safeParse(JSON.parse(timingMapText) as unknown);
  if (!parsedTimingMap.success) {
    throw new Error(`Narration timing map is invalid: ${contractErrorDetails(parsedTimingMap.error.issues)}`);
  }
  return parsedTimingMap.data;
}

async function loadNarrationVoiceCatalog(catalogPath: string): Promise<TtsCatalog> {
  const catalogText = await readFile(catalogPath, "utf8");
  const parsedCatalog = TtsCatalogSchema.safeParse(parseStructuredData(catalogPath, catalogText));
  if (!parsedCatalog.success) {
    throw new Error(`TTS voice catalog is invalid: ${contractErrorDetails(parsedCatalog.error.issues)}`);
  }
  return parsedCatalog.data;
}

async function loadCartesiaConfig(configPath: string): Promise<CartesiaConfig> {
  const configText = await readFile(configPath, "utf8");
  const parsedConfig = CartesiaConfigSchema.safeParse(parseStructuredData(configPath, configText));
  if (!parsedConfig.success) {
    throw new Error(`Cartesia configuration is invalid: ${contractErrorDetails(parsedConfig.error.issues)}`);
  }
  return parsedConfig.data;
}

async function loadVolcengineTtsConfig(configPath: string): Promise<VolcengineTtsConfig> {
  const configText = await readFile(configPath, "utf8");
  const parsedConfig = VolcengineTtsConfigSchema.safeParse(parseStructuredData(configPath, configText));
  if (!parsedConfig.success) {
    throw new Error(`Volcengine TTS configuration is invalid: ${contractErrorDetails(parsedConfig.error.issues)}`);
  }
  return parsedConfig.data;
}

async function loadCartesiaPronunciationCatalog(catalogPath: string): Promise<CartesiaPronunciationCatalog> {
  const catalogText = await readFile(catalogPath, "utf8");
  const parsedCatalog = CartesiaPronunciationCatalogSchema.safeParse(parseStructuredData(catalogPath, catalogText));
  if (!parsedCatalog.success) {
    throw new Error(`Cartesia pronunciation catalog is invalid: ${contractErrorDetails(parsedCatalog.error.issues)}`);
  }
  return parsedCatalog.data;
}

async function loadSubjectAssetCatalog(catalogPath: string): Promise<SubjectAssetCatalog> {
  const catalogText = await readFile(catalogPath, "utf8");
  const parsedCatalog = SubjectAssetCatalogSchema.safeParse(parseStructuredData(catalogPath, catalogText));
  if (!parsedCatalog.success) {
    throw new Error(`Subject asset catalog contract is invalid: ${contractErrorDetails(parsedCatalog.error.issues)}`);
  }
  return parsedCatalog.data;
}

async function persistCartesiaPronunciationCatalog(
  catalogPath: string,
  catalog: CartesiaPronunciationCatalog
): Promise<void> {
  if (!/\.ya?ml$/i.test(catalogPath)) {
    throw new Error("Cartesia pronunciation catalog must be stored as YAML so its live remote id can be updated.");
  }
  await writeFile(catalogPath, stringifyYaml(catalog));
}

function isCartesiaConfigured(): boolean {
  return Boolean(process.env.CARTESIA_API_KEY);
}

function isVolcengineTtsConfigured(): boolean {
  return Boolean(process.env.VOLCENGINE_TTS_API_KEY);
}

async function loadLocalCartesiaEnvironment(): Promise<void> {
  if (isCartesiaConfigured()) {
    return;
  }
  const environmentPath = resolve(".env");
  try {
    await access(environmentPath);
  } catch {
    return;
  }
  try {
    process.loadEnvFile(environmentPath);
    if (isCartesiaConfigured()) {
      console.warn("[knowledge-explainer] loaded local Cartesia TTS configuration from .env.");
    } else {
      console.warn("[knowledge-explainer] local .env does not define CARTESIA_API_KEY.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[knowledge-explainer] could not load local Cartesia TTS configuration path=${environmentPath}. ${message}`);
  }
}

async function loadLocalVolcengineTtsEnvironment(): Promise<void> {
  if (isVolcengineTtsConfigured()) {
    return;
  }
  const environmentPath = resolve(".env");
  try {
    await access(environmentPath);
  } catch {
    return;
  }
  try {
    process.loadEnvFile(environmentPath);
    if (isVolcengineTtsConfigured()) {
      console.warn("[knowledge-explainer] loaded local Volcengine TTS configuration from .env.");
    } else {
      console.warn("[knowledge-explainer] local .env does not define VOLCENGINE_TTS_API_KEY.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[knowledge-explainer] could not load local Volcengine TTS configuration path=${environmentPath}. ${message}`);
  }
}

function requireCartesiaApiKey(): string {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    throw new Error("CARTESIA_API_KEY is required for Cartesia synthesis.");
  }
  return apiKey;
}

function requireVolcengineTtsApiKey(): string {
  const apiKey = process.env.VOLCENGINE_TTS_API_KEY;
  if (!apiKey) {
    throw new Error("VOLCENGINE_TTS_API_KEY is required for Volcengine TTS 2.0 synthesis.");
  }
  return apiKey;
}

function assertTtsOutputFormat(
  outputPath: string,
  audioFormat: NarrationAudioFormat
): void {
  if (extname(outputPath).toLocaleLowerCase() !== `.${audioFormat}`) {
    throw new Error(`Selected TTS provider requires an output file ending in .${audioFormat}.`);
  }
}

async function prepareCartesiaNarrationSynthesis(
  request: CliRequest,
  narrationPlan: NarrationSynthesisPlan,
  voiceChoice: NarrationVoiceChoice
): Promise<NarrationSynthesisSetup> {
  const cartesiaConfig = await loadCartesiaConfig(resolve(request.cartesiaConfigPath ?? "config/narration/cartesia.yaml"));
  const pronunciationCatalogPath = resolve(request.pronunciationCatalogPath ?? "config/narration/pronunciations.yaml");
  const pronunciationCatalog = await loadCartesiaPronunciationCatalog(pronunciationCatalogPath);
  const pronunciationSync = await new CartesiaPronunciationDictionaryGateway({
    apiKey: requireCartesiaApiKey(),
    apiVersion: cartesiaConfig.apiVersion
  }).synchronizeCatalog(pronunciationCatalog);
  const synchronizedPronunciationCatalog = pronunciationSync.remoteId && pronunciationSync.remoteId !== pronunciationCatalog.dictionary.remoteId
    ? {
        ...pronunciationCatalog,
        dictionary: { ...pronunciationCatalog.dictionary, remoteId: pronunciationSync.remoteId }
      }
    : pronunciationCatalog;
  if (synchronizedPronunciationCatalog !== pronunciationCatalog) {
    await persistCartesiaPronunciationCatalog(pronunciationCatalogPath, synchronizedPronunciationCatalog);
  }
  if (pronunciationSync.entryIds.length > 0) {
    console.info(`[knowledge-explainer] synchronized Cartesia pronunciation entries: ${pronunciationSync.entryIds.join(", ")}.`);
  }
  const model = request.model ?? cartesiaConfig.modelId;
  return {
    audioFormat: "wav",
    gateway: new CartesiaTtsGateway({
      apiKey: requireCartesiaApiKey(),
      voiceId: voiceChoice.voice.providerVoiceId,
      modelId: model,
      apiVersion: cartesiaConfig.apiVersion,
      language: narrationPlan.language,
      synthesis: narrationPlan.synthesis,
      pronunciationCatalog: synchronizedPronunciationCatalog,
      pronunciationDictionaryId: synchronizedPronunciationCatalog.dictionary.remoteId
    }),
    model,
    voiceChoice,
    language: narrationPlan.language
  };
}

async function prepareVolcengineNarrationSynthesis(
  request: CliRequest,
  narrationPlan: NarrationSynthesisPlan,
  voiceChoice: NarrationVoiceChoice
): Promise<NarrationSynthesisSetup> {
  const volcengineConfig = await loadVolcengineTtsConfig(
    resolve(request.volcengineConfigPath ?? "config/narration/volcengine.yaml")
  );
  const model = request.model ?? volcengineConfig.resourceId;
  return {
    audioFormat: volcengineConfig.audio.format,
    gateway: new VolcengineTtsGateway({
      apiKey: requireVolcengineTtsApiKey(),
      voiceId: voiceChoice.voice.providerVoiceId,
      resourceId: model,
      endpoint: volcengineConfig.endpoint,
      audio: volcengineConfig.audio,
      language: narrationPlan.language,
      synthesis: narrationPlan.synthesis,
      explicitLanguage: volcengineConfig.explicitLanguage,
      voiceInstruction: volcengineConfig.voiceInstruction
    }),
    model,
    voiceChoice,
    language: narrationPlan.language
  };
}

function prepareMacosSayNarrationSynthesis(
  narrationPlan: NarrationSynthesisPlan,
  voiceChoice: NarrationVoiceChoice
): NarrationSynthesisSetup {
  return {
    audioFormat: "wav",
    gateway: new MacosSayTtsGateway({
      voiceId: voiceChoice.voice.providerVoiceId,
      synthesis: narrationPlan.synthesis
    }),
    model: "macos-say",
    voiceChoice,
    language: narrationPlan.language
  };
}

async function prepareNarrationSynthesis(
  request: CliRequest,
  narrationPlan: NarrationSynthesisPlan
): Promise<NarrationSynthesisSetup> {
  const catalog = await loadNarrationVoiceCatalog(resolve(request.voiceCatalogPath ?? "config/narration/voices.yaml"));
  const voiceChoice = chooseNarrationVoice({
    catalog,
    voiceProfileId: narrationPlan.voiceProfileId
  });
  if (voiceChoice.providerId === "cartesia") {
    await loadLocalCartesiaEnvironment();
    return prepareCartesiaNarrationSynthesis(request, narrationPlan, voiceChoice);
  }
  if (voiceChoice.providerId === "volcengine") {
    await loadLocalVolcengineTtsEnvironment();
    return prepareVolcengineNarrationSynthesis(request, narrationPlan, voiceChoice);
  }
  if (voiceChoice.providerId === "macos-say") {
    return prepareMacosSayNarrationSynthesis(narrationPlan, voiceChoice);
  }
  const unknownProvider: never = voiceChoice.providerId;
  throw new Error(`Unsupported TTS provider ${unknownProvider}.`);
}

function audioDurationMs(audioPath: string): number {
  const output = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audioPath],
    { encoding: "utf8" }
  ).trim();
  const durationSeconds = Number(output);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`Could not measure narration audio duration path=${audioPath}.`);
  }
  return Math.round(durationSeconds * 1000);
}

async function synthesizeContinuousNarration(
  source: NarrationProductionSource,
  outputPath: string,
  timingMapPath: string,
  setup: NarrationSynthesisSetup
): Promise<NarrationSynthesisOutput> {
  // 口播只使用 Skill 审核过的连续正文；字幕卡既不决定断句，也不注入额外停顿。
  const continuousNarration: NarrationSynthesisSegment[] = [{ text: source.script }];
  const result = await setup.gateway.synthesizeNarration({
    segments: continuousNarration,
    outputPath,
    format: setup.audioFormat,
    language: setup.language
  });

  const durationMs = audioDurationMs(outputPath);
  const timingMap = createProportionalNarrationTimingMap({
    durationMs,
    beats: source.beats.map((beat) => ({ id: beat.id, narrationText: beat.text }))
  });
  const absoluteTimingMapPath = resolve(timingMapPath);
  await mkdir(dirname(absoluteTimingMapPath), { recursive: true });
  await writeFile(absoluteTimingMapPath, `${JSON.stringify(timingMap, null, 2)}\n`);
  return {
    result,
    timingMap
  };
}

function resolveWhisperTranscriptionOutputPrefix(timingMapPath: string): string {
  const absoluteTimingMapPath = resolve(timingMapPath);
  const timingMapName = basename(absoluteTimingMapPath).replace(/(?:\.timing)?\.json$/i, "");
  return join(dirname(absoluteTimingMapPath), `${timingMapName}.whisper-small`);
}

async function assertLocalAlignmentPath(label: string, requestedPath: string): Promise<string> {
  const absolutePath = resolve(requestedPath);
  try {
    await access(absolutePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[knowledge-explainer] ${label} path is unavailable path=${absolutePath}. ${message}`);
    throw new Error(`Local forced alignment requires ${label} at ${absolutePath}.`);
  }
  return absolutePath;
}

async function resolveWhisperExecutablePath(requestedPath: string): Promise<string> {
  if (requestedPath.includes("/") || requestedPath.startsWith(".")) {
    return assertLocalAlignmentPath("Whisper executable", requestedPath);
  }
  try {
    const executablePath = execFileSync("which", [requestedPath], { encoding: "utf8" }).trim();
    if (executablePath.length === 0) {
      throw new Error("which returned an empty path");
    }
    return assertLocalAlignmentPath("Whisper executable", executablePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[knowledge-explainer] Whisper executable is unavailable command=${requestedPath}. ${message}`);
    throw new Error(
      "Local forced alignment requires whisper-cli. Run <skill-root>/scripts/prepare-local-asr.sh --install, or pass --whisper-binary <path>."
    );
  }
}

async function alignNarration(
  source: NarrationProductionSource,
  request: CliRequest
): Promise<void> {
  const narrationAudioAsset = resolvePublicProductionAsset({
    requestedPath: request.audioPath!,
    publicDirectory: workspaceAssetsRoot,
    assetLabel: "narration audio"
  });
  const localAsrRuntime = resolveLocalAsrRuntime({
    homeDirectory: homedir(),
    environment: process.env,
    platform: process.platform,
    whisperBinaryPath: request.whisperBinaryPath,
    whisperModelPath: request.whisperModelPath
  });
  const whisperBinaryPath = await resolveWhisperExecutablePath(localAsrRuntime.whisperBinaryPath);
  const whisperModelPath = await assertLocalAlignmentPath("Whisper model", localAsrRuntime.whisperModelPath);
  const timingMapPath = resolve(request.outputPath!);
  const transcriptionOutputPrefix = resolveWhisperTranscriptionOutputPrefix(timingMapPath);
  await mkdir(dirname(timingMapPath), { recursive: true });

  // 先让本地 ASR 只做可复查的时间识别，再由已确认脚本回填画面字幕，避免识别错字污染成片文案。
  await runChildCommand({
    executable: whisperBinaryPath,
    arguments: [
      "-m", whisperModelPath,
      "-f", narrationAudioAsset.absolutePath,
      "-l", source.language,
      "-ml", "1",
      "-oj",
      "-ojf",
      "-of", transcriptionOutputPrefix
    ]
  });
  const transcriptionPath = `${transcriptionOutputPrefix}.json`;
  const transcriptionSource = await readFile(transcriptionPath, "utf8");
  const tokens = parseWhisperTranscriptionTokens(JSON.parse(transcriptionSource) as unknown);
  const alignment = createLocalForcedAlignmentTimingMap({
    durationMs: audioDurationMs(narrationAudioAsset.absolutePath),
    cards: source.beats.map((beat) => ({ id: beat.id, narrationText: beat.text })),
    tokens,
    minimumExactMatchRatio: request.minimumAlignmentRatio ?? 0.85
  });
  if (alignment.quality.interpolatedCharacterCount > 0) {
    console.warn(
      `[knowledge-explainer] local forced alignment interpolated ${alignment.quality.interpolatedCharacterCount} source characters after ASR omissions.`
    );
  }
  if (alignment.quality.rebalancedCharacterCount > 0) {
    console.warn(
      `[knowledge-explainer] local forced alignment rebalanced ${alignment.quality.rebalancedCharacterCount} source characters across implausible ASR spans segments=${alignment.quality.rebalancedSegmentIds.join(",")}.`
    );
  }
  if (alignment.quality.clampedTerminalTokenCount > 0) {
    console.warn(
      `[knowledge-explainer] local forced alignment clamped ${alignment.quality.clampedTerminalTokenCount} terminal ASR token to the measured audio duration.`
    );
  }
  await writeFile(timingMapPath, `${JSON.stringify(alignment.timingMap, null, 2)}\n`);
  console.log(JSON.stringify({
    status: "pass",
    episodeId: source.episodeId,
    audioPath: narrationAudioAsset.absolutePath,
    transcriptionPath,
    timingMapPath,
    quality: alignment.quality
  }, null, 2));
}

async function assertAudioAssetAvailable(projectId: string, label: string, assetPath: string): Promise<void> {
  const absoluteAssetPath = resolve(workspaceAssetsRoot, assetPath);
  try {
    await access(absoluteAssetPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[knowledge-explainer] missing ${label} asset path=${absoluteAssetPath}. ${message}`);
    throw new Error(`Project ${projectId} requires ${label} audio ${assetPath}.`);
  }
}

function runChildCommand(command: ChildCommand): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command.executable, command.arguments, {
      cwd: process.cwd(),
      stdio: "inherit"
    });
    child.once("error", (error) => {
      console.warn(`[knowledge-explainer] render command could not start: ${error.message}`);
      rejectPromise(error);
    });
    child.once("exit", (exitCode) => {
      if (exitCode === 0) {
        resolvePromise();
        return;
      }
      const error = new Error(`Render command exited with code ${exitCode ?? "unknown"}.`);
      console.warn(`[knowledge-explainer] ${error.message}`);
      rejectPromise(error);
    });
  });
}

function inspectionFileName(shotId: string, phase: string, frame: number): string {
  const paddedFrame = String(frame).padStart(4, "0");
  return `${paddedFrame}-${shotId}-${phase}.png`;
}

async function synthesizeKnowledgeExplainerNarration(
  account: KnowledgeExplainerAccountProfile,
  plan: KnowledgeExplainerCreationPlan,
  request: CliRequest
): Promise<void> {
  const narrationPlan = resolveKnowledgeExplainerNarrationPlan(account, plan);
  const setup = await prepareNarrationSynthesis(request, narrationPlan);
  const outputPath = resolve(request.outputPath!);
  assertTtsOutputFormat(outputPath, setup.audioFormat);
  const timingMapPath = request.timingMapPath ?? `${outputPath}.timing.json`;
  const output = await synthesizeContinuousNarration({
    episodeId: plan.id,
    language: plan.episode.language,
    script: createKnowledgeExplainerNarrationScript(plan),
    beats: plan.cards.map((card) => ({ id: card.id, text: card.spokenText }))
  }, outputPath, timingMapPath, setup);
  console.log(JSON.stringify({
    status: "pass",
    episodeId: plan.id,
    captionCardCount: plan.cards.length,
    provider: output.result.provider,
    model: setup.model,
    voice: setup.voiceChoice.voice ? {
      profileId: setup.voiceChoice.voice.id,
      displayName: setup.voiceChoice.voice.displayName,
      gender: setup.voiceChoice.voice.gender,
      language: setup.voiceChoice.voice.language,
      useCases: setup.voiceChoice.voice.useCases
    } : undefined,
    audioPath: output.result.audioPath,
    timingMapPath: resolve(timingMapPath),
    timingMap: output.timingMap
      ? { source: output.timingMap.source, durationMs: output.timingMap.durationMs, segments: output.timingMap.segments.length }
      : undefined
  }, null, 2));
}

async function alignKnowledgeExplainerNarration(
  plan: KnowledgeExplainerCreationPlan,
  request: CliRequest
): Promise<void> {
  await alignNarration({
    episodeId: plan.id,
    language: plan.episode.language,
    script: createKnowledgeExplainerNarrationScript(plan),
    beats: plan.cards.map((card) => ({ id: card.id, text: card.spokenText }))
  }, request);
}

async function loadProduction(projectPath: string): Promise<ProjectProduction> {
  const projectInput: unknown = JSON.parse(await readFile(projectPath, "utf8"));
  const parsedProject = KnowledgeExplainerProductionLockSchema.safeParse(projectInput);
  if (!parsedProject.success) throw new Error(`Production contract is invalid: ${contractErrorDetails(parsedProject.error.issues)}`);
  return parsedProject.data;
}

function assertRenderableProject(project: ProjectProduction): void {
  const issues = validateKnowledgeExplainerProduction(project);
  if (issues.length > 0) throw new Error(`Project quality gate failed: ${issues.join("; ")}`);
}

function projectVisualAssetReferences(project: ProjectProduction): VisualAssetReference[] {
  return project.scenes.map((scene) => ({ ownerId: scene.id, ownerType: "scene" as const,
      assetPath: scene.illustration.assetPath }));
}

async function assertVisualAssetsAvailable(project: ProjectProduction): Promise<void> {
  for (const assetReference of projectVisualAssetReferences(project)) {
    const assetPath = resolve(workspaceAssetsRoot, assetReference.assetPath);
    try { await access(assetPath); } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[knowledge-explainer] missing visual asset owner=${assetReference.ownerId} path=${assetPath}. ${message}`);
      throw new Error(`Visual asset ${assetReference.assetPath} is unavailable.`);
    }
    if (assetReference.expectedSha256) {
      const actualSha256 = createHash("sha256").update(await readFile(assetPath)).digest("hex");
      if (actualSha256 !== assetReference.expectedSha256) {
        console.warn(`[knowledge-explainer] approved asset changed path=${assetPath} expected=${assetReference.expectedSha256} actual=${actualSha256}.`);
        throw new Error(`Approved visual asset ${assetReference.ownerId} no longer matches its registered hash.`);
      }
    }
  }
}

async function assertAudioAssetsAvailable(project: ProjectProduction): Promise<void> {
  await assertAudioAssetAvailable(project.id, "narration", project.narration.audioPath);
  if (project.knowledgeExplainer.backgroundMusic.assetPath) {
    await assertAudioAssetAvailable(project.id, "background music", project.knowledgeExplainer.backgroundMusic.assetPath);
  }
}

async function renderProjectProduction(project: ProjectProduction, outputPath: string): Promise<void> {
  const absoluteOutputPath = resolve(outputPath);
  await mkdir(dirname(absoluteOutputPath), { recursive: true });
  // 固化生产文件后，由当前项目唯一的渲染器生成成片。
  const renderPropsPath = `${absoluteOutputPath}.props.json`;
  await writeFile(renderPropsPath, JSON.stringify({ project }, null, 2));
  await runChildCommand({ executable: resolveEnginePath("node_modules/.bin/remotion"), arguments: [
    "render", resolveEnginePath("packages/renderer/src/index.ts"), "KnowledgeExplainer", absoluteOutputPath,
    "--props", renderPropsPath, "--public-dir", workspaceAssetsRoot, "--codec", "h264", "--concurrency", "50%"
  ] });
}

function projectInspectionFrames(project: ProjectProduction) {
  return planKnowledgeExplainerInspectionFrames(project);
}

async function inspectProjectProduction(project: ProjectProduction, outputDirectory: string): Promise<void> {
  // 根据当前方法的渲染实现生成关键帧验收材料。
  const absoluteOutputDirectory = resolve(outputDirectory);
  const renderPropsPath = join(absoluteOutputDirectory, "render-props.json");
  await rm(absoluteOutputDirectory, { recursive: true, force: true });
  await mkdir(absoluteOutputDirectory, { recursive: true });
  await writeFile(renderPropsPath, JSON.stringify({ project }, null, 2));
  for (const inspectionFrame of projectInspectionFrames(project)) {
    const imagePath = join(absoluteOutputDirectory,
      inspectionFileName(inspectionFrame.shotId, inspectionFrame.phase, inspectionFrame.frame));
    await renderInspectionStill(project, renderPropsPath, imagePath, inspectionFrame.frame);
  }
}

async function renderInspectionStill(
  project: ProjectProduction,
  renderPropsPath: string,
  imagePath: string,
  frame: number
): Promise<void> {
  const remotionExecutable = resolveEnginePath("node_modules/.bin/remotion");
  const rendererEntry = resolveEnginePath("packages/renderer/src/index.ts");
  const inspectCommand: ChildCommand = {
    executable: remotionExecutable,
    arguments: [
      "still",
      rendererEntry,
      "KnowledgeExplainer",
      imagePath,
      "--props",
      renderPropsPath,
      "--public-dir",
      workspaceAssetsRoot,
      "--frame",
      String(frame)
    ]
  };
  console.warn(`[knowledge-explainer] inspect is using Remotion still fallback for project=${project.id}.`);
  await runChildCommand(inspectCommand);
}

async function inspectRenderedVideo(
  project: ProjectProduction,
  videoPath: string,
  outputDirectory: string
): Promise<void> {
  const absoluteVideoPath = resolve(videoPath);
  const absoluteOutputDirectory = resolve(outputDirectory);
  try {
    await access(absoluteVideoPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[knowledge-explainer] inspection video is unavailable path=${absoluteVideoPath}. ${message}`);
    throw new Error(`Cannot inspect missing video ${videoPath}.`);
  }
  await rm(absoluteOutputDirectory, { recursive: true, force: true });
  await mkdir(absoluteOutputDirectory, { recursive: true });

  for (const inspectionFrame of projectInspectionFrames(project)) {
    const imagePath = join(
      absoluteOutputDirectory,
      inspectionFileName(inspectionFrame.shotId, inspectionFrame.phase, inspectionFrame.frame)
    );
    const frameSelector = `select=eq(n\\,${inspectionFrame.frame})`;
    const extractCommand: ChildCommand = {
      executable: "ffmpeg",
      arguments: [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        absoluteVideoPath,
        "-vf",
        frameSelector,
        "-frames:v",
        "1",
        "-y",
        imagePath
      ]
    };
    await runChildCommand(extractCommand);
  }
}

async function runCli(): Promise<void> {
  const request = parseCliRequest(process.argv.slice(2));

  // 先处理配置与模板发现命令，不读取单期生产文件。
  if (request.command === "list-voices") {
    const catalogPath = resolve(request.voiceCatalogPath ?? "config/narration/voices.yaml");
    const catalog = await loadNarrationVoiceCatalog(catalogPath);
    console.log(JSON.stringify({ status: "pass", catalogPath, voices: catalog.voices }, null, 2)); return;
  }
  if (request.command === "list-pronunciations") {
    const catalogPath = resolve(request.pronunciationCatalogPath ?? "config/narration/pronunciations.yaml");
    const catalog = await loadCartesiaPronunciationCatalog(catalogPath);
    console.log(JSON.stringify({ status: "pass", catalogPath, dictionary: catalog.dictionary, entries: catalog.entries }, null, 2)); return;
  }
  if (request.command === "list-subjects") {
    const catalogPath = resolve(request.subjectCatalogPath ?? "config/assets/subjects.yaml");
    const catalog = await loadSubjectAssetCatalog(catalogPath);
    console.log(JSON.stringify({ status: "pass", catalogPath, subjects: catalog.subjects }, null, 2)); return;
  }
  if (request.command === "describe-knowledge-explainer") {
    const account = await loadKnowledgeExplainerAccountProfile(resolve(request.accountPath!));
    const series = account.series.find((candidate) => candidate.id === request.seriesId);
    if (!series) throw new Error(`Knowledge explainer account ${account.id} does not define series ${request.seriesId}.`);
    console.log(JSON.stringify({ status: "pass", creationMethodId: "knowledge-explainer", accountId: account.id,
      seriesId: series.id, templates: [describeKnowledgeExplainerTemplate(series.templateId,
        (request.viewId ?? series.defaultViewId) as KnowledgeExplainerViewId)] }, null, 2));
    return; }

  // 创作命令依次完成生产文件编译、连续旁白合成与实测时间对齐。
  if (request.command === "compose-knowledge-explainer") {
    const account = await loadKnowledgeExplainerAccountProfile(resolve(request.accountPath!));
    const plan = await loadKnowledgeExplainerCreationPlan(resolve(request.planPath!));
    const narrationAudioAsset = resolvePublicProductionAsset({
      requestedPath: request.audioPath!, publicDirectory: workspaceAssetsRoot, assetLabel: "narration audio"
    });
    const voiceCatalog = await loadNarrationVoiceCatalog(resolve(request.voiceCatalogPath ?? "config/narration/voices.yaml"));
    const mediaCatalog = await loadKnowledgeExplainerMediaCatalog(resolve(request.mediaCatalogPath ?? "config/method/media.yaml"));
    const illustrationCatalog = await loadKnowledgeExplainerIllustrationCatalog(resolve(request.illustrationCatalogPath ?? "config/method/illustrations.yaml"));
    const narrationTimingMap = request.timingMapPath ? await loadNarrationTimingMap(resolve(request.timingMapPath)) : undefined;
    if (narrationTimingMap) {
      assertNarrationAssetsSynchronized({ audioDurationMs: audioDurationMs(narrationAudioAsset.absolutePath), timingMap: narrationTimingMap });
    }
    const composition = composeKnowledgeExplainerProduction(account, plan, {
      seed: request.seed, narrationTimingMap, preview: request.preview,
      viewId: request.viewId as KnowledgeExplainerViewId | undefined,
      voiceCatalog, mediaCatalog, illustrationCatalog, narrationAudioPath: narrationAudioAsset.publicPath
    });
    const absoluteOutputPath = resolve(request.outputPath!);
    await mkdir(dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, JSON.stringify(composition.lock, null, 2));
    for (const warning of composition.duration.warnings) console.warn(`[knowledge-explainer] ${warning}`);
    console.log(JSON.stringify({ status: "pass", accountId: account.id, episodeId: plan.id,
      productionId: composition.lock.id, duration: composition.duration, output: absoluteOutputPath }, null, 2));
    return; }
  if (request.command === "synthesize-knowledge-explainer") {
    const account = await loadKnowledgeExplainerAccountProfile(resolve(request.accountPath!));
    const plan = await loadKnowledgeExplainerCreationPlan(resolve(request.planPath!));
    await synthesizeKnowledgeExplainerNarration(account, plan, request); return;
  }
  if (request.command === "align-knowledge-explainer") {
    const plan = await loadKnowledgeExplainerCreationPlan(resolve(request.planPath!));
    await alignKnowledgeExplainerNarration(plan, request); return;
  }

  // 成片入口统一执行契约、素材和质量门禁。
  const project = await loadProduction(resolve(request.projectPath));
  if (shouldApplyProjectQualityGate(request.command)) assertRenderableProject(project);
  await assertVisualAssetsAvailable(project);
  await assertAudioAssetsAvailable(project);
  if (request.command === "validate") {
    console.log(JSON.stringify({ status: "pass", projectId: project.id }, null, 2)); return;
  }
  if (request.command === "inspect") {
    if (request.videoPath) await inspectRenderedVideo(project, request.videoPath, request.outputDirectory!);
    else await inspectProjectProduction(project, request.outputDirectory!);
    console.log(JSON.stringify({ status: "pass", projectId: project.id, outputDirectory: resolve(request.outputDirectory!) }, null, 2)); return;
  }
  if (request.command === "verify") {
    await renderProjectProduction(project, request.outputPath!);
    await inspectRenderedVideo(project, request.outputPath!, request.outputDirectory!);
    console.log(JSON.stringify({ status: "pass", projectId: project.id, output: resolve(request.outputPath!),
      outputDirectory: resolve(request.outputDirectory!) }, null, 2)); return;
  }
  await renderProjectProduction(project, request.outputPath!);
  console.log(JSON.stringify({ status: "pass", projectId: project.id, output: resolve(request.outputPath!) }, null, 2));
}

runCli().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[knowledge-explainer] ${message}`);
  process.exitCode = 1;
});
