import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  CartesiaPronunciationCatalog,
  CartesiaSynthesisSettings,
  TtsVoiceLanguage
} from "@knowledge-explainer/contracts";
import type {
  FetchTransport,
  NarrationSynthesisRequest,
  NarrationSynthesisResult,
  NarrationSynthesisSegment,
  TtsGateway
} from "./tts-gateway";
import { applyCartesiaSpellCorrections } from "./apply-cartesia-pronunciation-corrections";

export type {
  FetchTransport,
  NarrationAudioFormat,
  NarrationSynthesisRequest,
  NarrationSynthesisResult,
  NarrationSynthesisSegment,
  TtsGateway
} from "./tts-gateway";

export type CartesiaTtsGatewayConfig = {
  apiKey: string;
  voiceId: string;
  modelId: string;
  apiVersion: string;
  language: TtsVoiceLanguage;
  synthesis: CartesiaSynthesisSettings;
  pronunciationCatalog?: CartesiaPronunciationCatalog;
  pronunciationDictionaryId?: string;
  endpoint?: string;
};

const defaultEndpoint = "https://api.cartesia.ai/tts/bytes";

function mergeSynthesisSettings(
  defaults: CartesiaSynthesisSettings,
  segment: NarrationSynthesisSegment | undefined
): CartesiaSynthesisSettings {
  return {
    emotion: segment?.direction?.emotion ?? defaults.emotion,
    speed: segment?.direction?.speed ?? defaults.speed,
    volume: segment?.direction?.volume ?? defaults.volume
  };
}

function assertCartesiaGenerationControlsAvailable(
  modelId: string,
  synthesis: CartesiaSynthesisSettings
): void {
  if (/^sonic-3\.5(?:-|$)/.test(modelId) && (synthesis.speed !== 1 || synthesis.volume !== 1)) {
    throw new Error(
      `Cartesia model ${modelId} does not currently support speed control or volume control. Use a sonic-3 snapshot for paced narration.`
    );
  }
}

function createCartesiaGenerationConfig(
  modelId: string,
  synthesis: CartesiaSynthesisSettings
): Pick<CartesiaSynthesisSettings, "emotion"> | CartesiaSynthesisSettings {
  if (/^sonic-3\.5(?:-|$)/.test(modelId)) {
    return { emotion: synthesis.emotion };
  }
  return synthesis;
}

function compileCartesiaNarration(
  request: NarrationSynthesisRequest,
  pronunciationCatalog: CartesiaPronunciationCatalog | undefined,
  language: TtsVoiceLanguage
): string {
  const appliedEntryIds = new Set<string>();
  const transcript = request.segments
    .map((segment) => {
      const correction = applyCartesiaSpellCorrections(segment.text, pronunciationCatalog, language);
      correction.appliedEntryIds.forEach((entryId) => appliedEntryIds.add(entryId));
      const pauseAfterMs = segment.pauseAfterMs ?? 0;
      if (!Number.isInteger(pauseAfterMs) || pauseAfterMs < 0 || pauseAfterMs > 2000) {
        throw new Error("Cartesia pauseAfterMs must be an integer from 0 to 2000.");
      }
      return pauseAfterMs === 0 ? correction.transcript : `${correction.transcript}<break time="${pauseAfterMs}ms"/>`;
    })
    .join("\n");
  if (appliedEntryIds.size > 0) {
    console.info(`[knowledge-explainer] Cartesia applied inline spelling corrections: ${[...appliedEntryIds].join(", ")}.`);
  }
  return transcript;
}

function resolveCartesiaErrorMessage(response: Response, responseText: string): string {
  const compactBody = responseText.replace(/\s+/g, " ").trim().slice(0, 300);
  const details = compactBody ? ` body=${compactBody}` : "";
  return `Cartesia TTS request failed status=${response.status}.${details}`;
}

export class CartesiaTtsGateway implements TtsGateway {
  private readonly endpoint: string;

  public constructor(
    private readonly config: CartesiaTtsGatewayConfig,
    private readonly fetchTransport: FetchTransport = fetch
  ) {
    this.endpoint = config.endpoint ?? defaultEndpoint;
  }

  public async synthesizeNarration(
    request: NarrationSynthesisRequest
  ): Promise<NarrationSynthesisResult> {
    if (request.format !== "wav") {
      throw new Error("Knowledge Explainer Cartesia synthesis currently requires format=wav.");
    }
    if (request.segments.length === 0) {
      throw new Error("Cartesia synthesis requires at least one narration segment.");
    }
    if (request.segments.length > 1 && request.segments.some((segment) => segment.direction?.emotion || segment.direction?.speed || segment.direction?.volume)) {
      console.warn(
        "[knowledge-explainer] Cartesia per-card delivery settings are most reliable with measured synthesis. Using series defaults for this combined request."
      );
    }
    const synthesis = request.segments.length === 1
      ? mergeSynthesisSettings(this.config.synthesis, request.segments[0])
      : this.config.synthesis;
    assertCartesiaGenerationControlsAvailable(this.config.modelId, synthesis);
    const response = await this.fetchTransport(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Cartesia-Version": this.config.apiVersion,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model_id: this.config.modelId,
        transcript: compileCartesiaNarration(
          request,
          this.config.pronunciationCatalog,
          request.language ?? this.config.language
        ),
        voice: { mode: "id", id: this.config.voiceId },
        output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 44100 },
        language: request.language ?? this.config.language,
        pronunciation_dict_id: this.config.pronunciationDictionaryId,
        generation_config: createCartesiaGenerationConfig(this.config.modelId, synthesis)
      })
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(resolveCartesiaErrorMessage(response, responseText));
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    if (audioBuffer.byteLength === 0) {
      throw new Error("Cartesia TTS returned an empty audio response.");
    }

    await mkdir(dirname(request.outputPath), { recursive: true });
    await writeFile(request.outputPath, audioBuffer);
    return {
      provider: "cartesia",
      audioPath: request.outputPath,
      format: request.format
    };
  }
}
