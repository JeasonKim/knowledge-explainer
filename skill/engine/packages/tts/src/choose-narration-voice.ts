import type {
  TtsCatalog,
  TtsProviderId,
  TtsVoiceProfile
} from "@knowledge-explainer/contracts";

export type NarrationVoiceChoiceRequest = {
  catalog: TtsCatalog;
  voiceProfileId: string;
};

export type NarrationVoiceChoice = {
  providerId: TtsProviderId;
  voice: TtsVoiceProfile;
};

function findNarrationVoice(catalog: TtsCatalog, voiceProfileId: string): TtsVoiceProfile {
  const voice = catalog.voices.find((candidate) => candidate.id === voiceProfileId);
  if (!voice) {
    throw new Error(`TTS catalog does not define voice ${voiceProfileId}.`);
  }
  return voice;
}

export function chooseNarrationVoice(
  request: NarrationVoiceChoiceRequest
): NarrationVoiceChoice {
  const voice = findNarrationVoice(request.catalog, request.voiceProfileId);
  return {
    providerId: voice.provider,
    voice
  };
}
