import { describe, expect, it } from "vitest";
import type { TtsCatalog } from "@knowledge-explainer/contracts";
import { chooseNarrationVoice } from "./choose-narration-voice";

const catalog: TtsCatalog = {
  kind: "tts-voice-catalog",
  voices: [
    {
      id: "cartesia-example-zh",
      displayName: "我的 Cartesia 中文音色",
      provider: "cartesia",
      providerVoiceId: "example-cartesia-voice",
      gender: "unspecified",
      language: "zh",
      useCases: ["知识短视频"],
      tags: []
    }
  ]
};

describe("chooseNarrationVoice", () => {
  it("按音色档案选择 Cartesia 音色", () => {
    expect(chooseNarrationVoice({
      catalog,
      voiceProfileId: "cartesia-example-zh"
    })).toMatchObject({
      providerId: "cartesia",
      voice: { providerVoiceId: "example-cartesia-voice" }
    });
  });

  it("拒绝引用不存在的音色", () => {
    expect(() => chooseNarrationVoice({
      catalog,
      voiceProfileId: "missing-voice"
    })).toThrow("does not define voice");
  });
});
