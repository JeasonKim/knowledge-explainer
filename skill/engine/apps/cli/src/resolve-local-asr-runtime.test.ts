import { describe, expect, it } from "vitest";
import { resolveLocalAsrRuntime, type LocalAsrRuntimeInput } from "./resolve-local-asr-runtime";

function createRuntimeInput(overrides: Partial<LocalAsrRuntimeInput> = {}): LocalAsrRuntimeInput {
  return {
    homeDirectory: "/Users/creator",
    environment: {},
    platform: "darwin",
    ...overrides
  };
}

describe("resolveLocalAsrRuntime", () => {
  it("将 macOS 的共享模型目录与 PATH 中的标准 CLI 作为默认运行时", () => {
    expect(resolveLocalAsrRuntime(createRuntimeInput())).toEqual({
      whisperBinaryPath: "whisper-cli",
      whisperModelPath: "/Users/creator/Library/Application Support/AIModels/whisper.cpp/ggml-small.bin"
    });
  });

  it("支持 Linux XDG 模型目录，避免把模型放入工程", () => {
    expect(resolveLocalAsrRuntime(createRuntimeInput({
      homeDirectory: "/home/creator",
      environment: { XDG_DATA_HOME: "/data/user" },
      platform: "linux"
    }))).toMatchObject({
      whisperModelPath: "/data/user/ai-models/whisper.cpp/ggml-small.bin"
    });
  });

  it("让命令行参数覆盖环境变量，环境变量再覆盖默认目录", () => {
    expect(resolveLocalAsrRuntime(createRuntimeInput({
      whisperBinaryPath: "/custom/whisper-cli",
      whisperModelPath: "/custom/model.bin",
      environment: {
        KNOWLEDGE_EXPLAINER_WHISPER_BINARY: "/environment/whisper-cli",
        KNOWLEDGE_EXPLAINER_WHISPER_MODEL: "/environment/model.bin",
        KNOWLEDGE_EXPLAINER_MODEL_HOME: "/environment/models"
      }
    }))).toEqual({
      whisperBinaryPath: "/custom/whisper-cli",
      whisperModelPath: "/custom/model.bin"
    });
  });

  it("只读取视频创作命名空间下的环境变量", () => {
    expect(resolveLocalAsrRuntime(createRuntimeInput({
      environment: {
        KNOWLEDGE_EXPLAINER_WHISPER_BINARY: "/environment/whisper-cli",
        KNOWLEDGE_EXPLAINER_WHISPER_MODEL: "/environment/model.bin",
        KNOWLEDGE_EXPLAINER_MODEL_HOME: "/environment/models"
      }
    }))).toEqual({
      whisperBinaryPath: "/environment/whisper-cli",
      whisperModelPath: "/environment/model.bin"
    });
  });
});
