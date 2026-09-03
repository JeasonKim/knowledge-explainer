import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  NarrationEmotion,
  NarrationSynthesisSettings,
  TtsVoiceLanguage,
  VolcengineTtsAudioConfig
} from "@knowledge-explainer/contracts";
import type {
  FetchTransport,
  NarrationSynthesisRequest,
  NarrationSynthesisResult,
  NarrationSynthesisSegment,
  TtsGateway
} from "./tts-gateway";

export type { FetchTransport } from "./tts-gateway";

export type VolcengineTtsGatewayConfig = {
  apiKey: string;
  voiceId: string;
  resourceId: string;
  endpoint: string;
  audio: VolcengineTtsAudioConfig;
  language: TtsVoiceLanguage;
  synthesis: NarrationSynthesisSettings;
  explicitLanguage?: string;
  voiceInstruction?: string;
};

type VolcengineTtsResponseEvent = {
  code?: number;
  message?: string;
  data?: string;
};

const emotionInstructions: Record<NarrationEmotion, string> = {
  neutral: "请自然、清晰地播报，语气稳定。",
  calm: "请用平静、克制的口吻，节奏自然，不刻意煽情。",
  content: "请用温和、松弛的口吻，保持清晰和自然。",
  sad: "请带一点低回感，但保持克制、清晰，避免哭腔。",
  sympathetic: "请带着理解与共情，但不要过度安慰或煽情。",
  contemplative: "请用沉静、有思考感的口吻，节奏从容，不煽情。",
  confident: "请用笃定、清晰的口吻，避免咄咄逼人。",
  determined: "请用坚定、有力量的口吻，保持冷静和自然。"
};

function compileVolcengineNarration(segments: NarrationSynthesisSegment[]): string {
  if (segments.length === 0) {
    throw new Error("Volcengine synthesis requires at least one narration segment.");
  }
  const pauses = segments.filter((segment) => (segment.pauseAfterMs ?? 0) > 0);
  if (pauses.length > 0) {
    console.warn(
      "[knowledge-explainer] Volcengine TTS 2.0 continuous narration does not inject segment pauseAfterMs; use natural punctuation in the approved script."
    );
  }
  return segments.map((segment) => segment.text).join("");
}

function compileVolcengineVoiceInstruction(
  defaultInstruction: string | undefined,
  emotion: NarrationEmotion
): string {
  return [defaultInstruction, emotionInstructions[emotion]].filter(Boolean).join("");
}

function resolveVolcengineSynthesisSettings(
  defaults: NarrationSynthesisSettings,
  segment: NarrationSynthesisSegment | undefined
): NarrationSynthesisSettings {
  return {
    emotion: segment?.direction?.emotion ?? defaults.emotion,
    speed: segment?.direction?.speed ?? defaults.speed,
    volume: segment?.direction?.volume ?? defaults.volume
  };
}

function resolveVolcengineResponseError(response: Response, responseText: string): Error {
  const compactBody = responseText.replace(/\s+/g, " ").trim().slice(0, 300);
  const details = compactBody ? ` body=${compactBody}` : "";
  return new Error(`Volcengine TTS request failed status=${response.status}.${details}`);
}

function isVolcengineSuccessCode(code: number | undefined): boolean {
  return code === undefined || code === 0 || code === 20000000;
}

function decodeVolcengineAudio(responseText: string): Buffer {
  const audioChunks: Buffer[] = [];
  const lines = responseText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    let event: VolcengineTtsResponseEvent;
    try {
      event = JSON.parse(line) as VolcengineTtsResponseEvent;
    } catch {
      throw new Error("Volcengine TTS response contains a non-JSON streaming event.");
    }
    if (!isVolcengineSuccessCode(event.code)) {
      throw new Error(`Volcengine TTS synthesis failed code=${event.code}${event.message ? ` message=${event.message}` : ""}.`);
    }
    if (typeof event.data === "string" && event.data.length > 0) {
      audioChunks.push(Buffer.from(event.data, "base64"));
    }
  }
  const audio = Buffer.concat(audioChunks);
  if (audio.byteLength === 0) {
    throw new Error("Volcengine TTS returned no audio data.");
  }
  return audio;
}

export class VolcengineTtsGateway implements TtsGateway {
  public constructor(
    private readonly config: VolcengineTtsGatewayConfig,
    private readonly fetchTransport: FetchTransport = fetch
  ) {}

  public async synthesizeNarration(
    request: NarrationSynthesisRequest
  ): Promise<NarrationSynthesisResult> {
    if (request.format !== this.config.audio.format) {
      throw new Error(
        `Volcengine TTS requires format=${this.config.audio.format} from config/narration/volcengine.yaml, received ${request.format}.`
      );
    }
    const transcript = compileVolcengineNarration(request.segments);
    const synthesis = request.segments.length === 1
      ? resolveVolcengineSynthesisSettings(this.config.synthesis, request.segments[0])
      : this.config.synthesis;
    const response = await this.fetchTransport(this.config.endpoint, {
      method: "POST",
      headers: {
        "X-Api-Key": this.config.apiKey,
        "X-Api-Resource-Id": this.config.resourceId,
        "X-Api-Request-Id": randomUUID(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user: { uid: "knowledge-explainer" },
        req_params: {
          text: transcript,
          speaker: this.config.voiceId,
          audio_params: {
            format: this.config.audio.format,
            sample_rate: this.config.audio.sampleRate
          },
          speed_ratio: synthesis.speed,
          volume_ratio: synthesis.volume,
          additions: this.config.explicitLanguage
            ? JSON.stringify({ explicit_language: this.config.explicitLanguage })
            : undefined,
          voice_instruction: compileVolcengineVoiceInstruction(
            this.config.voiceInstruction,
            synthesis.emotion
          )
        }
      })
    });
    const responseText = await response.text();
    if (!response.ok) {
      throw resolveVolcengineResponseError(response, responseText);
    }
    const audio = decodeVolcengineAudio(responseText);
    await mkdir(dirname(request.outputPath), { recursive: true });
    await writeFile(request.outputPath, audio);
    return {
      provider: "volcengine",
      audioPath: request.outputPath,
      format: request.format
    };
  }
}
