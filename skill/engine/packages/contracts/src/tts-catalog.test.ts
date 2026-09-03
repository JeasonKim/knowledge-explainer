import { describe, expect, it } from "vitest";
import { TtsCatalogSchema } from "./index";

const catalog = {
  kind: "tts-voice-catalog",
  voices: [{
    id: "cartesia-example-zh",
    displayName: "我的 Cartesia 中文音色",
    provider: "cartesia",
    providerVoiceId: "example-cartesia-voice",
    gender: "unspecified",
    language: "zh",
    useCases: ["知识短视频", "观点讲解", "温和叙事"]
  }]
};

describe("TtsCatalogSchema", () => {
  it("将可选音色作为持久化清单校验", () => {
    const parsedCatalog = TtsCatalogSchema.parse(catalog);

    expect(parsedCatalog.voices[0]).toMatchObject({
      id: "cartesia-example-zh",
      provider: "cartesia",
      language: "zh"
    });
  });

  it("拒绝已移除供应商的音色", () => {
    const parsedCatalog = TtsCatalogSchema.safeParse({
      kind: "tts-voice-catalog",
      voices: [{
        id: "unsupported-voice",
        displayName: "云舟 - 知识讲解",
        provider: "unsupported-provider",
        providerVoiceId: "unsupported-provider-voice",
        gender: "male",
        language: "zh",
        useCases: ["知识短视频"]
      }]
    });

    expect(parsedCatalog.success).toBe(false);
  });

  it("允许将豆包语音合成 2.0 音色登记为可选择的持久化档案", () => {
    const parsedCatalog = TtsCatalogSchema.parse({
      kind: "tts-voice-catalog",
      voices: [{
        id: "volcengine-example-zh",
        displayName: "豆包语音合成 2.0 自定义中文音色",
        provider: "volcengine",
        providerVoiceId: "example-volcengine-voice",
        gender: "unspecified",
        language: "zh",
        useCases: ["知识短视频"]
      }]
    });

    expect(parsedCatalog.voices[0]).toMatchObject({
      provider: "volcengine",
      providerVoiceId: "example-volcengine-voice"
    });
  });

  it("音色档案不再承载成片后期倍速", () => {
    const parsedCatalog = TtsCatalogSchema.parse({
      ...catalog,
      voices: [{
        ...catalog.voices[0],
        releasePacing: { playbackRate: 1.249 }
      }]
    });

    expect(parsedCatalog.voices[0]).not.toHaveProperty("releasePacing");
  });

  it("拒绝重复的持久化音色 id", () => {
    const duplicateVoice = TtsCatalogSchema.safeParse({
      ...catalog,
      voices: [catalog.voices[0], catalog.voices[0]]
    });
    expect(duplicateVoice.success).toBe(false);
  });
});
