import {createHash} from "node:crypto";
import {spawn} from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import {tmpdir} from "node:os";
import {basename, extname, join} from "node:path";

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".ogg",
  ".wav",
]);

export interface RecordingDescriptor {
  id: string;
  sourcePath: string;
  sourceName: string;
  sourceDate: string | null;
  titleHint: string;
}

export interface TranscriptArtifactPaths {
  rawTextDirectory: string;
  rawJsonDirectory: string;
  statusDirectory: string;
  logDirectory: string;
  rawTextPath: string;
  rawJsonPath: string;
  statusPath: string;
  errorLogPath: string;
}

export type TranscriptArtifactState = "pending" | "completed" | "inconsistent";

export interface SubprocessCommand {
  executable: string;
  arguments: string[];
}

export interface FfmpegCommandInput {
  ffmpegBinaryPath: string;
  sourcePath: string;
  wavPath: string;
}

export interface WhisperCommandInput {
  whisperBinaryPath: string;
  whisperModelPath: string;
  language: string;
  threadsPerWorker: number;
  wavPath: string;
  outputPrefix: string;
}

export type RecordingAction = (recording: RecordingDescriptor, workerId: number) => Promise<void>;

export interface LocalWhisperBatchConfig {
  sourceDirectory: string;
  outputDirectory: string;
  whisperBinaryPath: string;
  whisperModelPath: string;
  ffmpegBinaryPath: string;
  language: string;
  workerCount: number;
  threadsPerWorker: number;
  force: boolean;
  recordingLimit?: number;
}

export interface LocalWhisperBatchSummary {
  discovered: number;
  selected: number;
  completed: number;
  skipped: number;
  failed: number;
  elapsedSeconds: number;
}

export interface TranscriptionProgress {
  completedTasks: number;
  totalTasks: number;
  recording: RecordingDescriptor;
  result: "completed" | "skipped" | "failed";
  workerId: number;
  elapsedSeconds: number;
  error?: string;
}

export type TranscriptionProgressReporter = (progress: TranscriptionProgress) => void;

interface RecordingTranscriptionConfig {
  batch: LocalWhisperBatchConfig;
  recording: RecordingDescriptor;
  workerId: number;
}

interface RecordingTranscriptionResult {
  result: "completed" | "skipped" | "failed";
  elapsedSeconds: number;
  error?: string;
}

interface SubprocessResult {
  stdout: string;
  stderr: string;
}

interface TranscriptStatusRecord {
  id: string;
  status: "completed" | "failed";
  sourcePath: string;
  sourceName: string;
  sourceDate: string | null;
  titleHint: string;
  modelPath: string;
  language: string;
  workerId: number;
  startedAt: string;
  completedAt: string;
  elapsedSeconds: number;
  rawTextPath?: string;
  rawJsonPath?: string;
  error?: string;
}

export function deriveRecordingDescriptor(sourcePath: string): RecordingDescriptor {
  const sourceName = basename(sourcePath);
  const extension = extname(sourceName);
  const stem = sourceName.slice(0, -extension.length);
  const idMatch = stem.match(/_(\d{15,20})$/);
  const id = idMatch?.[1] ?? createHash("sha256").update(sourceName).digest("hex").slice(0, 16);
  const withoutId = idMatch ? stem.slice(0, idMatch.index) : stem;
  const dateMatch = withoutId.match(/^(\d{4})(\d{2})(\d{2})_(.+)$/);
  const sourceDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null;
  const titleHint = dateMatch?.[4] ?? withoutId;

  return {
    id,
    sourcePath,
    sourceName,
    sourceDate,
    titleHint,
  };
}

export async function discoverRecordings(sourceDirectory: string): Promise<RecordingDescriptor[]> {
  const entries = await readdir(sourceDirectory, {withFileTypes: true});

  return entries
    .filter((entry) => {
      if (!entry.isFile() || entry.name.startsWith(".")) {
        return false;
      }
      return SUPPORTED_AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase());
    })
    .map((entry) => deriveRecordingDescriptor(join(sourceDirectory, entry.name)))
    .sort((left, right) => left.sourceName.localeCompare(right.sourceName, "zh-CN"));
}

export function buildTranscriptArtifactPaths(
  outputDirectory: string,
  recordingId: string,
): TranscriptArtifactPaths {
  const rawTextDirectory = join(outputDirectory, "raw-text");
  const rawJsonDirectory = join(outputDirectory, "raw-json");
  const statusDirectory = join(outputDirectory, "status");
  const logDirectory = join(outputDirectory, "logs");

  return {
    rawTextDirectory,
    rawJsonDirectory,
    statusDirectory,
    logDirectory,
    rawTextPath: join(rawTextDirectory, `${recordingId}.txt`),
    rawJsonPath: join(rawJsonDirectory, `${recordingId}.json`),
    statusPath: join(statusDirectory, `${recordingId}.json`),
    errorLogPath: join(logDirectory, `${recordingId}.log`),
  };
}

export async function resolveArtifactState(
  paths: TranscriptArtifactPaths,
  force: boolean,
): Promise<TranscriptArtifactState> {
  if (force) {
    return "pending";
  }

  const [rawTextExists, rawJsonExists, statusExists] = await Promise.all([
    fileExists(paths.rawTextPath),
    fileExists(paths.rawJsonPath),
    fileExists(paths.statusPath),
  ]);

  if (!rawTextExists && !rawJsonExists && !statusExists) {
    return "pending";
  }

  if (!rawTextExists || !rawJsonExists || !statusExists) {
    return "inconsistent";
  }

  try {
    const status = JSON.parse(await readFile(paths.statusPath, "utf8")) as Partial<TranscriptStatusRecord>;
    return status.status === "completed" ? "completed" : "inconsistent";
  } catch (error) {
    console.warn(
      `[local-asr] 转写状态无法解析，将重新生成。status="${paths.statusPath}" reason="${formatError(error)}"`,
    );
    return "inconsistent";
  }
}

export function buildFfmpegCommand(input: FfmpegCommandInput): SubprocessCommand {
  return {
    executable: input.ffmpegBinaryPath,
    arguments: [
      "-v",
      "error",
      "-nostdin",
      "-y",
      "-i",
      input.sourcePath,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      input.wavPath,
    ],
  };
}

export function buildWhisperCommand(input: WhisperCommandInput): SubprocessCommand {
  return {
    executable: input.whisperBinaryPath,
    arguments: [
      "-m",
      input.whisperModelPath,
      "-l",
      input.language,
      "-t",
      String(input.threadsPerWorker),
      "-otxt",
      "-ojf",
      "-of",
      input.outputPrefix,
      input.wavPath,
    ],
  };
}

export async function runRecordingWorkers(
  recordings: RecordingDescriptor[],
  workerCount: number,
  action: RecordingAction,
): Promise<void> {
  if (!Number.isInteger(workerCount) || workerCount < 1) {
    throw new Error(`workerCount 必须是正整数，实际为 ${workerCount}`);
  }

  let nextRecordingIndex = 0;
  const claimNextRecording = (): RecordingDescriptor | undefined => {
    const recording = recordings[nextRecordingIndex];
    nextRecordingIndex += 1;
    return recording;
  };

  const runWorker = async (workerId: number): Promise<void> => {
    while (true) {
      const recording = claimNextRecording();
      if (!recording) {
        return;
      }
      await action(recording, workerId);
    }
  };

  await Promise.all(
    Array.from(
      {length: Math.min(workerCount, Math.max(recordings.length, 1))},
      (_, index) => runWorker(index + 1),
    ),
  );
}

export function resolveThreadsPerWorker(cpuCount: number, workerCount: number): number {
  if (!Number.isInteger(workerCount) || workerCount < 1) {
    throw new Error(`workerCount 必须是正整数，实际为 ${workerCount}`);
  }
  return Math.max(1, Math.floor(Math.max(1, cpuCount) / workerCount));
}

export function isUsableTranscriptText(transcript: string): boolean {
  return transcript.trim().length > 0;
}

export async function runLocalWhisperBatch(
  config: LocalWhisperBatchConfig,
  reportProgress: TranscriptionProgressReporter = reportProgressToConsole,
): Promise<LocalWhisperBatchSummary> {
  const startedAt = performance.now();
  await validateBatchRuntime(config);

  // 建立稳定任务集，并在启动昂贵的 ASR 前阻止作品 ID 冲突。
  const discoveredRecordings = await discoverRecordings(config.sourceDirectory);
  assertUniqueRecordingIds(discoveredRecordings);
  const selectedRecordings = config.recordingLimit
    ? discoveredRecordings.slice(0, config.recordingLimit)
    : discoveredRecordings;

  await prepareOutputDirectories(config.outputDirectory);

  let completed = 0;
  let skipped = 0;
  let failed = 0;
  let completedTasks = 0;

  // 三个 Worker 共享顺序队列，每条失败独立落盘，不阻断剩余素材。
  await runRecordingWorkers(selectedRecordings, config.workerCount, async (recording, workerId) => {
    const result = await transcribeRecording({
      batch: config,
      recording,
      workerId,
    });

    completedTasks += 1;
    if (result.result === "completed") {
      completed += 1;
    } else if (result.result === "skipped") {
      skipped += 1;
    } else {
      failed += 1;
    }

    reportProgress({
      completedTasks,
      totalTasks: selectedRecordings.length,
      recording,
      result: result.result,
      workerId,
      elapsedSeconds: result.elapsedSeconds,
      error: result.error,
    });
  });

  // 所有 Worker 停止写入后，再一次性发布确定性索引和人工校订队列。
  await publishTranscriptIndexes(config.outputDirectory);

  return {
    discovered: discoveredRecordings.length,
    selected: selectedRecordings.length,
    completed,
    skipped,
    failed,
    elapsedSeconds: roundSeconds(performance.now() - startedAt),
  };
}

async function transcribeRecording(
  config: RecordingTranscriptionConfig,
): Promise<RecordingTranscriptionResult> {
  const startedAt = performance.now();
  const startedAtIso = new Date().toISOString();
  const paths = buildTranscriptArtifactPaths(config.batch.outputDirectory, config.recording.id);
  const artifactState = await resolveArtifactState(paths, config.batch.force);

  if (artifactState === "completed") {
    return {
      result: "skipped",
      elapsedSeconds: roundSeconds(performance.now() - startedAt),
    };
  }

  if (artifactState === "inconsistent") {
    console.warn(
      `[local-asr] 发现不完整历史产物，将覆盖重建。recording="${config.recording.sourceName}" rawText="${paths.rawTextPath}" rawJson="${paths.rawJsonPath}" status="${paths.statusPath}"`,
    );
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), `knowledge-explainer-whisper-${config.recording.id}-`));
  const wavPath = join(temporaryDirectory, `${config.recording.id}.wav`);
  const temporaryOutputPrefix = join(temporaryDirectory, config.recording.id);
  const temporaryRawTextPath = `${temporaryOutputPrefix}.txt`;
  const temporaryRawJsonPath = `${temporaryOutputPrefix}.json`;

  try {
    const ffmpegCommand = buildFfmpegCommand({
      ffmpegBinaryPath: config.batch.ffmpegBinaryPath,
      sourcePath: config.recording.sourcePath,
      wavPath,
    });
    await executeSubprocess(ffmpegCommand);

    const whisperCommand = buildWhisperCommand({
      whisperBinaryPath: config.batch.whisperBinaryPath,
      whisperModelPath: config.batch.whisperModelPath,
      language: config.batch.language,
      threadsPerWorker: config.batch.threadsPerWorker,
      wavPath,
      outputPrefix: temporaryOutputPrefix,
    });
    await executeSubprocess(whisperCommand);

    await Promise.all([access(temporaryRawTextPath), access(temporaryRawJsonPath)]);
    const rawText = await readFile(temporaryRawTextPath, "utf8");
    if (!isUsableTranscriptText(rawText)) {
      throw new Error("Whisper 未输出有效文本，音频可能为空、损坏或不含可识别语音");
    }
    await publishFileAtomically(temporaryRawTextPath, paths.rawTextPath);
    await publishFileAtomically(temporaryRawJsonPath, paths.rawJsonPath);

    const elapsedSeconds = roundSeconds(performance.now() - startedAt);
    const status: TranscriptStatusRecord = {
      id: config.recording.id,
      status: "completed",
      sourcePath: config.recording.sourcePath,
      sourceName: config.recording.sourceName,
      sourceDate: config.recording.sourceDate,
      titleHint: config.recording.titleHint,
      modelPath: config.batch.whisperModelPath,
      language: config.batch.language,
      workerId: config.workerId,
      startedAt: startedAtIso,
      completedAt: new Date().toISOString(),
      elapsedSeconds,
      rawTextPath: paths.rawTextPath,
      rawJsonPath: paths.rawJsonPath,
    };
    await publishJsonAtomically(paths.statusPath, status);

    return {
      result: "completed",
      elapsedSeconds,
    };
  } catch (error) {
    const message = formatError(error);
    const elapsedSeconds = roundSeconds(performance.now() - startedAt);
    const status: TranscriptStatusRecord = {
      id: config.recording.id,
      status: "failed",
      sourcePath: config.recording.sourcePath,
      sourceName: config.recording.sourceName,
      sourceDate: config.recording.sourceDate,
      titleHint: config.recording.titleHint,
      modelPath: config.batch.whisperModelPath,
      language: config.batch.language,
      workerId: config.workerId,
      startedAt: startedAtIso,
      completedAt: new Date().toISOString(),
      elapsedSeconds,
      error: message,
    };
    await publishJsonAtomically(paths.statusPath, status);
    await publishTextAtomically(
      paths.errorLogPath,
      [
        `recording=${config.recording.sourceName}`,
        `source=${config.recording.sourcePath}`,
        `worker=${config.workerId}`,
        `error=${message}`,
      ].join("\n"),
    );
    console.error(
      `[local-asr] 转写失败，已记录并继续。recording="${config.recording.sourceName}" worker=${config.workerId} reason="${message}"`,
    );

    return {
      result: "failed",
      elapsedSeconds,
      error: message,
    };
  } finally {
    await rm(temporaryDirectory, {recursive: true, force: true});
  }
}

async function validateBatchRuntime(config: LocalWhisperBatchConfig): Promise<void> {
  if (!Number.isInteger(config.workerCount) || config.workerCount < 1) {
    throw new Error(`workerCount 必须是正整数，实际为 ${config.workerCount}`);
  }
  if (!Number.isInteger(config.threadsPerWorker) || config.threadsPerWorker < 1) {
    throw new Error(`threadsPerWorker 必须是正整数，实际为 ${config.threadsPerWorker}`);
  }
  if (config.recordingLimit !== undefined && config.recordingLimit < 1) {
    throw new Error(`recordingLimit 必须是正整数，实际为 ${config.recordingLimit}`);
  }

  await access(config.sourceDirectory);
  await access(config.whisperModelPath);
}

async function prepareOutputDirectories(outputDirectory: string): Promise<void> {
  const paths = buildTranscriptArtifactPaths(outputDirectory, "placeholder");
  await Promise.all([
    mkdir(paths.rawTextDirectory, {recursive: true}),
    mkdir(paths.rawJsonDirectory, {recursive: true}),
    mkdir(paths.statusDirectory, {recursive: true}),
    mkdir(paths.logDirectory, {recursive: true}),
  ]);
}

function assertUniqueRecordingIds(recordings: RecordingDescriptor[]): void {
  const sourceById = new Map<string, string>();
  for (const recording of recordings) {
    const existingSource = sourceById.get(recording.id);
    if (existingSource) {
      throw new Error(
        `检测到重复作品 ID，无法确定输出归属。id=${recording.id} first="${existingSource}" second="${recording.sourcePath}"`,
      );
    }
    sourceById.set(recording.id, recording.sourcePath);
  }
}

async function publishTranscriptIndexes(outputDirectory: string): Promise<void> {
  const statusDirectory = join(outputDirectory, "status");
  const statusEntries = await readdir(statusDirectory, {withFileTypes: true});
  const statuses: TranscriptStatusRecord[] = [];

  for (const entry of statusEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    try {
      const status = JSON.parse(
        await readFile(join(statusDirectory, entry.name), "utf8"),
      ) as TranscriptStatusRecord;
      statuses.push(status);
    } catch (error) {
      console.warn(
        `[local-asr] 索引忽略无法解析的状态文件。status="${join(statusDirectory, entry.name)}" reason="${formatError(error)}"`,
      );
    }
  }

  statuses.sort((left, right) => left.sourceName.localeCompare(right.sourceName, "zh-CN"));
  const completedStatuses = statuses.filter((status) => status.status === "completed");
  const failedStatuses = statuses.filter((status) => status.status === "failed");
  const reviewQueue: Array<TranscriptStatusRecord & {rawText: string}> = [];

  for (const status of completedStatuses) {
    if (!status.rawTextPath) {
      console.warn(
        `[local-asr] 完成状态缺少原始文本路径，未加入校订队列。id=${status.id} source="${status.sourcePath}"`,
      );
      continue;
    }
    try {
      reviewQueue.push({
        ...status,
        rawText: (await readFile(status.rawTextPath, "utf8")).trim(),
      });
    } catch (error) {
      console.warn(
        `[local-asr] 无法读取原始文本，未加入校订队列。id=${status.id} path="${status.rawTextPath}" reason="${formatError(error)}"`,
      );
    }
  }

  await Promise.all([
    publishJsonLinesAtomically(join(outputDirectory, "index.jsonl"), completedStatuses),
    publishJsonLinesAtomically(join(outputDirectory, "failed.jsonl"), failedStatuses),
    publishJsonLinesAtomically(join(outputDirectory, "review-queue.jsonl"), reviewQueue),
  ]);
}

async function executeSubprocess(command: SubprocessCommand): Promise<SubprocessResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.arguments, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", (error) => reject(error));
    child.once("close", (exitCode, signal) => {
      const result: SubprocessResult = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (exitCode === 0) {
        resolve(result);
        return;
      }
      reject(
        new Error(
          `命令执行失败 executable="${command.executable}" exitCode=${String(exitCode)} signal=${String(signal)} stderr="${result.stderr.slice(-2000)}"`,
        ),
      );
    });
  });
}

async function publishFileAtomically(sourcePath: string, destinationPath: string): Promise<void> {
  const temporaryPath = `${destinationPath}.partial`;
  await copyFile(sourcePath, temporaryPath);
  await rename(temporaryPath, destinationPath);
}

async function publishJsonAtomically(
  destinationPath: string,
  value: TranscriptStatusRecord,
): Promise<void> {
  await publishTextAtomically(destinationPath, `${JSON.stringify(value, null, 2)}\n`);
}

async function publishJsonLinesAtomically(
  destinationPath: string,
  values: readonly unknown[],
): Promise<void> {
  const content = values.length > 0
    ? `${values.map((value) => JSON.stringify(value)).join("\n")}\n`
    : "";
  await publishTextAtomically(destinationPath, content);
}

async function publishTextAtomically(destinationPath: string, content: string): Promise<void> {
  const temporaryPath = `${destinationPath}.partial`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, destinationPath);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function reportProgressToConsole(progress: TranscriptionProgress): void {
  const suffix = progress.error ? ` error="${progress.error}"` : "";
  console.log(
    `[local-asr] ${progress.completedTasks}/${progress.totalTasks} ${progress.result} worker=${progress.workerId} elapsed=${progress.elapsedSeconds}s id=${progress.recording.id} title="${progress.recording.titleHint}"${suffix}`,
  );
}

function roundSeconds(elapsedMilliseconds: number): number {
  return Math.round(elapsedMilliseconds / 100) / 10;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
