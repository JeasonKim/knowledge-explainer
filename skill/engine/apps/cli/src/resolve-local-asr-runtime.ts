import { join } from "node:path";

export type LocalAsrRuntimeInput = {
  homeDirectory: string;
  environment: Record<string, string | undefined>;
  platform: NodeJS.Platform;
  whisperBinaryPath?: string;
  whisperModelPath?: string;
};

export type LocalAsrRuntime = {
  whisperBinaryPath: string;
  whisperModelPath: string;
};

function resolveDefaultModelRoot(input: LocalAsrRuntimeInput): string {
  const configuredModelRoot = input.environment.KNOWLEDGE_EXPLAINER_MODEL_HOME;
  if (configuredModelRoot) {
    return configuredModelRoot;
  }
  return input.platform === "darwin"
    ? join(input.homeDirectory, "Library", "Application Support", "AIModels")
    : join(input.environment.XDG_DATA_HOME ?? join(input.homeDirectory, ".local", "share"), "ai-models");
}

export function resolveLocalAsrRuntime(input: LocalAsrRuntimeInput): LocalAsrRuntime {
  const modelRoot = resolveDefaultModelRoot(input);
  return {
    whisperBinaryPath: input.whisperBinaryPath ?? input.environment.KNOWLEDGE_EXPLAINER_WHISPER_BINARY ?? "whisper-cli",
    whisperModelPath: input.whisperModelPath
      ?? input.environment.KNOWLEDGE_EXPLAINER_WHISPER_MODEL
      ?? join(modelRoot, "whisper.cpp", "ggml-small.bin")
  };
}
