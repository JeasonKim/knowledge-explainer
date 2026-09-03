import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { NarrationSynthesisSettings } from "@knowledge-explainer/contracts";
import type {
  NarrationSynthesisRequest,
  NarrationSynthesisResult,
  TtsGateway
} from "./tts-gateway";

export type ExecuteMacosSayFile = (
  executable: string,
  argumentsList: string[]
) => Promise<void>;

export type MacosSayTtsGatewayOptions = {
  voiceId: string;
  synthesis: NarrationSynthesisSettings;
  executeFile?: ExecuteMacosSayFile;
};

const executeFileDefault = promisify(execFile);

function narrationText(request: NarrationSynthesisRequest): string {
  return request.segments.map((segment) => {
    const pause = segment.pauseAfterMs
      ? `[[slnc ${Math.round(segment.pauseAfterMs)}]]`
      : "";
    return `${segment.text}${pause}`;
  }).join("");
}

export class MacosSayTtsGateway implements TtsGateway {
  private readonly executeFile: ExecuteMacosSayFile;

  public constructor(private readonly options: MacosSayTtsGatewayOptions) {
    this.executeFile = options.executeFile ?? (async (executable, argumentsList) => {
      await executeFileDefault(executable, argumentsList);
    });
  }

  public async synthesizeNarration(
    request: NarrationSynthesisRequest
  ): Promise<NarrationSynthesisResult> {
    if (request.language !== "zh") {
      throw new Error(`macos-say only supports language=zh, received ${request.language}.`);
    }
    if (request.format !== "wav") {
      throw new Error(`macos-say only supports format=wav, received ${request.format}.`);
    }
    if (this.options.synthesis.emotion !== "neutral") {
      console.warn(
        `[knowledge-explainer] macos-say ignores unsupported emotion=${this.options.synthesis.emotion} `
        + `voice=${this.options.voiceId}; preserving speed and volume.`
      );
    }

    const temporaryDirectory = await mkdtemp(join(tmpdir(), "knowledge-explainer-macos-say-"));
    const scriptPath = join(temporaryDirectory, "narration.txt");
    const aiffPath = join(temporaryDirectory, "narration.aiff");
    const outputPath = resolve(request.outputPath);
    try {
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(scriptPath, narrationText(request), "utf8");
      await this.executeFile("say", [
        "-v",
        this.options.voiceId,
        "-r",
        String(Math.round(180 * this.options.synthesis.speed)),
        "-f",
        scriptPath,
        "-o",
        aiffPath
      ]);
      await this.executeFile("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        aiffPath,
        "-af",
        `volume=${this.options.synthesis.volume}`,
        "-ar",
        "44100",
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        outputPath
      ]);
      return {
        provider: "macos-say",
        audioPath: outputPath,
        format: "wav"
      };
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}
