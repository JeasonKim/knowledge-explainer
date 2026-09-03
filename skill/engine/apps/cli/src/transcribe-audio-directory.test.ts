import {mkdtemp, mkdir, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {describe, expect, it} from "vitest";
import {
  buildFfmpegCommand,
  buildTranscriptArtifactPaths,
  buildWhisperCommand,
  deriveRecordingDescriptor,
  discoverRecordings,
  isUsableTranscriptText,
  resolveArtifactState,
  resolveThreadsPerWorker,
  runRecordingWorkers,
  type RecordingDescriptor,
} from "./transcribe-audio-directory";

describe("deriveRecordingDescriptor", () => {
  it("优先使用文件名末尾的抖音作品 ID，并提取日期和标题提示", () => {
    const recording = deriveRecordingDescriptor(
      "/audio/20260724_起名的最高境界#起名_7666024227649429861.m4a",
    );

    expect(recording).toEqual({
      id: "7666024227649429861",
      sourcePath: "/audio/20260724_起名的最高境界#起名_7666024227649429861.m4a",
      sourceName: "20260724_起名的最高境界#起名_7666024227649429861.m4a",
      sourceDate: "2026-07-24",
      titleHint: "起名的最高境界#起名",
    });
  });

  it("没有作品 ID 时生成稳定的短哈希，避免长文件名污染输出路径", () => {
    const first = deriveRecordingDescriptor("/audio/普通口播.m4a");
    const second = deriveRecordingDescriptor("/audio/普通口播.m4a");

    expect(first.id).toMatch(/^[a-f0-9]{16}$/);
    expect(first.id).toBe(second.id);
    expect(first.sourceDate).toBeNull();
    expect(first.titleHint).toBe("普通口播");
  });
});

describe("discoverRecordings", () => {
  it("只发现受支持的正式音频文件，并保持稳定排序", async () => {
    const sourceDirectory = await mkdtemp(join(tmpdir(), "knowledge-explainer-audio-source-"));
    await writeFile(join(sourceDirectory, "20260702_B_7000000000000000002.wav"), "");
    await writeFile(join(sourceDirectory, "20260701_A_7000000000000000001.m4a"), "");
    await writeFile(join(sourceDirectory, ".partial.m4a"), "");
    await writeFile(join(sourceDirectory, "说明.txt"), "");

    const recordings = await discoverRecordings(sourceDirectory);

    expect(recordings.map((recording) => recording.id)).toEqual([
      "7000000000000000001",
      "7000000000000000002",
    ]);
  });
});

describe("resolveArtifactState", () => {
  it("只有原文、分段 JSON 和完成状态同时存在时才跳过", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "knowledge-explainer-transcripts-"));
    const recording = deriveRecordingDescriptor("/audio/test_7000000000000000001.m4a");
    const paths = buildTranscriptArtifactPaths(outputDirectory, recording.id);

    expect(await resolveArtifactState(paths, false)).toBe("pending");

    await mkdir(paths.statusDirectory, {recursive: true});
    await writeFile(paths.statusPath, JSON.stringify({status: "completed"}));
    expect(await resolveArtifactState(paths, false)).toBe("inconsistent");

    await mkdir(paths.rawTextDirectory, {recursive: true});
    await mkdir(paths.rawJsonDirectory, {recursive: true});
    await writeFile(paths.rawTextPath, "测试");
    await writeFile(paths.rawJsonPath, "{}");
    expect(await resolveArtifactState(paths, false)).toBe("completed");
    expect(await resolveArtifactState(paths, true)).toBe("pending");
  });
});

describe("build transcription commands", () => {
  it("统一转换为 16kHz 单声道 WAV", () => {
    expect(
      buildFfmpegCommand({
        ffmpegBinaryPath: "/opt/homebrew/bin/ffmpeg",
        sourcePath: "/audio/source.m4a",
        wavPath: "/tmp/source.wav",
      }),
    ).toEqual({
      executable: "/opt/homebrew/bin/ffmpeg",
      arguments: [
        "-v",
        "error",
        "-nostdin",
        "-y",
        "-i",
        "/audio/source.m4a",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        "/tmp/source.wav",
      ],
    });
  });

  it("固定使用 small 模型路径、中文和完整 JSON 输出", () => {
    expect(
      buildWhisperCommand({
        whisperBinaryPath: "/opt/homebrew/bin/whisper-cli",
        whisperModelPath: "/models/ggml-small.bin",
        language: "zh",
        threadsPerWorker: 2,
        wavPath: "/tmp/source.wav",
        outputPrefix: "/tmp/result",
      }),
    ).toEqual({
      executable: "/opt/homebrew/bin/whisper-cli",
      arguments: [
        "-m",
        "/models/ggml-small.bin",
        "-l",
        "zh",
        "-t",
        "2",
        "-otxt",
        "-ojf",
        "-of",
        "/tmp/result",
        "/tmp/source.wav",
      ],
    });
  });
});

describe("runRecordingWorkers", () => {
  it("最多同时运行三个录音任务，并且每条任务只执行一次", async () => {
    const recordings: RecordingDescriptor[] = Array.from({length: 8}, (_, index) => ({
      id: String(index),
      sourcePath: `/audio/${index}.m4a`,
      sourceName: `${index}.m4a`,
      sourceDate: null,
      titleHint: String(index),
    }));
    const visited: string[] = [];
    let active = 0;
    let maxActive = 0;

    await runRecordingWorkers(recordings, 3, async (recording) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      visited.push(recording.id);
      active -= 1;
    });

    expect(maxActive).toBe(3);
    expect(visited.sort()).toEqual(recordings.map((recording) => recording.id).sort());
  });
});

describe("resolveThreadsPerWorker", () => {
  it("按 CPU 核心数均分线程，并至少为每个 Worker 保留一个线程", () => {
    expect(resolveThreadsPerWorker(8, 3)).toBe(2);
    expect(resolveThreadsPerWorker(6, 3)).toBe(2);
    expect(resolveThreadsPerWorker(2, 3)).toBe(1);
  });
});

describe("isUsableTranscriptText", () => {
  it("拒绝空白转写，避免把静音或损坏音频误记为成功", () => {
    expect(isUsableTranscriptText(" \n\t")).toBe(false);
    expect(isUsableTranscriptText("这是一条有效转写。")).toBe(true);
  });
});
