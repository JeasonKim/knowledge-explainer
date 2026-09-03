import {cpus, homedir} from "node:os";
import {join, resolve} from "node:path";
import {
  resolveThreadsPerWorker,
  runLocalWhisperBatch,
  type LocalWhisperBatchConfig,
} from "../apps/cli/src/transcribe-audio-directory";
import {workspaceRoot} from "../apps/cli/src/runtime-paths";

interface CliArguments {
  sourceDirectory: string;
  outputDirectory: string;
  whisperBinaryPath: string;
  whisperModelPath: string;
  ffmpegBinaryPath: string;
  language: string;
  workerCount: number;
  threadsPerWorker?: number;
  force: boolean;
  recordingLimit?: number;
  showHelp: boolean;
}

const DEFAULT_WORKER_COUNT = 3;

async function main(): Promise<void> {
  const cli = parseCliArguments(process.argv.slice(2));
  if (cli.showHelp) {
    printHelp();
    return;
  }

  const threadsPerWorker = cli.threadsPerWorker
    ?? resolveThreadsPerWorker(cpus().length, cli.workerCount);
  const config: LocalWhisperBatchConfig = {
    sourceDirectory: cli.sourceDirectory,
    outputDirectory: cli.outputDirectory,
    whisperBinaryPath: cli.whisperBinaryPath,
    whisperModelPath: cli.whisperModelPath,
    ffmpegBinaryPath: cli.ffmpegBinaryPath,
    language: cli.language,
    workerCount: cli.workerCount,
    threadsPerWorker,
    force: cli.force,
    recordingLimit: cli.recordingLimit,
  };

  console.log(
    [
      "[local-asr] 启动批量转写",
      `source="${config.sourceDirectory}"`,
      `output="${config.outputDirectory}"`,
      `workers=${config.workerCount}`,
      `threadsPerWorker=${config.threadsPerWorker}`,
      `model="${config.whisperModelPath}"`,
      `language=${config.language}`,
      `force=${config.force}`,
      `limit=${config.recordingLimit ?? "all"}`,
    ].join(" "),
  );

  const summary = await runLocalWhisperBatch(config);
  console.log(`[local-asr] 完成 ${JSON.stringify(summary)}`);
  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

function parseCliArguments(argv: string[]): CliArguments {
  const homeDirectory = homedir();
  const result: CliArguments = {
    sourceDirectory: join(workspaceRoot, "assets", "imports", "audio"),
    outputDirectory: join(workspaceRoot, "artifacts", "transcripts"),
    whisperBinaryPath: process.env.KNOWLEDGE_EXPLAINER_WHISPER_BINARY ?? "whisper-cli",
    whisperModelPath: process.env.KNOWLEDGE_EXPLAINER_WHISPER_MODEL
      ?? join(homeDirectory, "Library", "Application Support", "AIModels", "whisper.cpp", "ggml-small.bin"),
    ffmpegBinaryPath: process.env.KNOWLEDGE_EXPLAINER_FFMPEG_BINARY ?? "ffmpeg",
    language: "zh",
    workerCount: DEFAULT_WORKER_COUNT,
    force: false,
    showHelp: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") {
      continue;
    } else if (argument === "--help" || argument === "-h") {
      result.showHelp = true;
    } else if (argument === "--force") {
      result.force = true;
    } else if (argument === "--source") {
      result.sourceDirectory = resolve(readRequiredValue(argv, ++index, argument));
    } else if (argument === "--output") {
      result.outputDirectory = resolve(readRequiredValue(argv, ++index, argument));
    } else if (argument === "--whisper-binary") {
      result.whisperBinaryPath = readRequiredValue(argv, ++index, argument);
    } else if (argument === "--whisper-model") {
      result.whisperModelPath = resolve(readRequiredValue(argv, ++index, argument));
    } else if (argument === "--ffmpeg-binary") {
      result.ffmpegBinaryPath = readRequiredValue(argv, ++index, argument);
    } else if (argument === "--language") {
      result.language = readRequiredValue(argv, ++index, argument);
    } else if (argument === "--workers") {
      result.workerCount = readPositiveInteger(argv, ++index, argument);
    } else if (argument === "--threads-per-worker") {
      result.threadsPerWorker = readPositiveInteger(argv, ++index, argument);
    } else if (argument === "--limit") {
      result.recordingLimit = readPositiveInteger(argv, ++index, argument);
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }

  return result;
}

function readRequiredValue(argv: string[], index: number, option: string): string {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} 缺少参数值`);
  }
  return value;
}

function readPositiveInteger(argv: string[], index: number, option: string): number {
  const value = Number(readRequiredValue(argv, index, option));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${option} 必须是正整数`);
  }
  return value;
}

function printHelp(): void {
  console.log(`批量使用本机 whisper-cli 转写音频目录。

默认运行三个独立 Worker，每个 Worker 的线程数为 CPU 核心数除以 Worker 数。

用法：
  pnpm run transcribe:audio-directory
  pnpm run transcribe:audio-directory -- --source <音频目录> --output <输出目录>

选项：
  --source <目录>              默认 <workspace>/assets/imports/audio
  --output <目录>              默认 <workspace>/artifacts/transcripts
  --workers <数量>             默认 3
  --threads-per-worker <数量>  默认按 CPU 核心数均分
  --whisper-binary <路径>      默认 KNOWLEDGE_EXPLAINER_WHISPER_BINARY 或 whisper-cli
  --whisper-model <路径>       默认用户级 ggml-small.bin
  --ffmpeg-binary <路径>       默认 KNOWLEDGE_EXPLAINER_FFMPEG_BINARY 或 ffmpeg
  --language <语言>            默认 zh
  --limit <数量>               只转写前 N 条，用于小批量演练
  --force                       覆盖已有成功产物
  --help                        显示帮助
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[local-asr] 批量转写终止 reason="${message}"`);
  process.exitCode = 1;
});
