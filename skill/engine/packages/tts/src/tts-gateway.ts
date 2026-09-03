import type {
  NarrationDirection,
  TtsProviderId,
  TtsVoiceLanguage
} from "@knowledge-explainer/contracts";

export type { TtsProviderId } from "@knowledge-explainer/contracts";

export type NarrationAudioFormat = "mp3" | "wav";

export type NarrationSynthesisSegment = {
  text: string;
  direction?: NarrationDirection;
  pauseAfterMs?: number;
};

export type NarrationSynthesisRequest = {
  segments: NarrationSynthesisSegment[];
  outputPath: string;
  format: NarrationAudioFormat;
  language?: TtsVoiceLanguage;
};

export type NarrationSynthesisResult = {
  provider: TtsProviderId;
  audioPath: string;
  format: NarrationAudioFormat;
};

export type TtsGateway = {
  synthesizeNarration(request: NarrationSynthesisRequest): Promise<NarrationSynthesisResult>;
};

export type FetchTransport = typeof fetch;
