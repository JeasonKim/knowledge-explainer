import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CartesiaPronunciationCatalogSchema } from "@knowledge-explainer/contracts";
import { CartesiaTtsGateway, type FetchTransport } from "./cartesia-tts-gateway";

type CapturedFetchRequest = { url: string; init: RequestInit | undefined };

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function createGateway(
  fetchTransport: FetchTransport,
  pronunciationCatalog = CartesiaPronunciationCatalogSchema.parse({
    kind: "cartesia-pronunciation-catalog",
    dictionary: { name: "Knowledge Explainer", description: "测试" },
    entries: []
  })
): CartesiaTtsGateway {
  return new CartesiaTtsGateway({
    apiKey: "test-key",
    voiceId: "voice-id",
    modelId: "sonic-3-2026-01-12",
    apiVersion: "2026-03-01",
    language: "zh",
    synthesis: { emotion: "calm", speed: 1.15, volume: 1 },
    pronunciationCatalog,
    pronunciationDictionaryId: "dictionary-id"
  }, fetchTransport);
}

describe("CartesiaTtsGateway", () => {
  it("将单卡导演指令和术语词典映射为 Cartesia Sonic 的中文 WAV 请求", async () => {
    const directory = await mkdtemp(join(tmpdir(), "knowledge-explainer-cartesia-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "narration.wav");
    let capturedRequest: CapturedFetchRequest | undefined;
    const fetchTransport: FetchTransport = async (input, init) => {
      capturedRequest = { url: String(input), init };
      return new Response(new Uint8Array([82, 73, 70, 70]), { status: 200, headers: { "Content-Type": "audio/wav" } });
    };

    const result = await createGateway(fetchTransport).synthesizeNarration({
      segments: [{ text: "第一句。", direction: { emotion: "contemplative", speed: 1.08, volume: 0.94 }, pauseAfterMs: 480 }],
      outputPath,
      format: "wav"
    });

    expect(JSON.parse(String(capturedRequest?.init?.body))).toEqual({
      model_id: "sonic-3-2026-01-12",
      transcript: "第一句。<break time=\"480ms\"/>",
      voice: { mode: "id", id: "voice-id" },
      output_format: { container: "wav", encoding: "pcm_s16le", sample_rate: 44100 },
      language: "zh",
      pronunciation_dict_id: "dictionary-id",
      generation_config: { emotion: "contemplative", speed: 1.08, volume: 0.94 }
    });
    await expect(readFile(outputPath)).resolves.toEqual(Buffer.from([82, 73, 70, 70]));
    expect(result).toEqual({ provider: "cartesia", audioPath: outputPath, format: "wav" });
  });

  it("合并请求遇到逐卡设置时明确降级为系列默认值", async () => {
    const directory = await mkdtemp(join(tmpdir(), "knowledge-explainer-cartesia-"));
    temporaryDirectories.push(directory);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let body: Record<string, unknown> | undefined;
    const fetchTransport: FetchTransport = async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(new Uint8Array([1]), { status: 200 });
    };

    await createGateway(fetchTransport).synthesizeNarration({
      segments: [
        { text: "第一句。", direction: { emotion: "sad" } },
        { text: "第二句。", direction: { emotion: "confident" } }
      ],
      outputPath: join(directory, "narration.wav"),
      format: "wav"
    });

    expect(body?.generation_config).toEqual({ emotion: "calm", speed: 1.15, volume: 1 });
    expect(warn).toHaveBeenCalledWith(
      "[knowledge-explainer] Cartesia per-card delivery settings are most reliable with measured synthesis. Using series defaults for this combined request."
    );
    warn.mockRestore();
  });

  it("将完整口播正文原样作为一次请求发送，不注入展示换行或卡片停顿", async () => {
    const directory = await mkdtemp(join(tmpdir(), "knowledge-explainer-cartesia-"));
    temporaryDirectories.push(directory);
    let body: Record<string, unknown> | undefined;
    const fetchTransport: FetchTransport = async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(new Uint8Array([1]), { status: 200 });
    };

    await createGateway(fetchTransport).synthesizeNarration({
      segments: [{ text: "第一句带自然标点，第二句继续完整表达。" }],
      outputPath: join(directory, "narration.wav"),
      format: "wav"
    });

    expect(body?.transcript).toBe("第一句带自然标点，第二句继续完整表达。");
  });

  it("通用分段接口仍可在明确指定时保留停顿", async () => {
    const directory = await mkdtemp(join(tmpdir(), "knowledge-explainer-cartesia-"));
    temporaryDirectories.push(directory);
    const requests: CapturedFetchRequest[] = [];
    const fetchTransport: FetchTransport = async (input, init) => {
      requests.push({ url: String(input), init });
      return new Response(new Uint8Array([1]), { status: 200 });
    };

    await createGateway(fetchTransport).synthesizeNarration({
      segments: [
        { text: "第一句。", pauseAfterMs: 180 },
        { text: "第二句。", pauseAfterMs: 0 },
        { text: "第三句。", pauseAfterMs: 360 }
      ],
      outputPath: join(directory, "narration.wav"),
      format: "wav"
    });

    expect(requests).toHaveLength(1);
    expect(JSON.parse(String(requests[0]?.init?.body))).toMatchObject({
      transcript: "第一句。<break time=\"180ms\"/>\n第二句。\n第三句。<break time=\"360ms\"/>",
      generation_config: { emotion: "calm", speed: 1.15, volume: 1 }
    });
  });

  it("拒绝在暂不支持变速的 Sonic 3.5 上生成需要加速的口播", async () => {
    const gateway = new CartesiaTtsGateway({
      apiKey: "test-key",
      voiceId: "voice-id",
      modelId: "sonic-3.5-2026-05-04",
      apiVersion: "2026-03-01",
      language: "zh",
      synthesis: { emotion: "calm", speed: 1.35, volume: 1 }
    });

    await expect(gateway.synthesizeNarration({
      segments: [{ text: "这段口播需要加速。" }],
      outputPath: join(tmpdir(), "knowledge-explainer-cartesia-should-not-write.wav"),
      format: "wav"
    })).rejects.toThrow("does not currently support speed control");
  });

  it("在 Sonic 3.5 上只发送仍受支持的情绪配置", async () => {
    const directory = await mkdtemp(join(tmpdir(), "knowledge-explainer-cartesia-"));
    temporaryDirectories.push(directory);
    let body: Record<string, unknown> | undefined;
    const fetchTransport: FetchTransport = async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(new Uint8Array([1]), { status: 200 });
    };
    const gateway = new CartesiaTtsGateway({
      apiKey: "test-key",
      voiceId: "voice-id",
      modelId: "sonic-3.5-2026-05-04",
      apiVersion: "2026-03-01",
      language: "zh",
      synthesis: { emotion: "calm", speed: 1, volume: 1 }
    }, fetchTransport);

    await gateway.synthesizeNarration({
      segments: [{ text: "自然速度口播。" }],
      outputPath: join(directory, "narration.wav"),
      format: "wav"
    });

    expect(body?.generation_config).toEqual({ emotion: "calm" });
  });

  it("将英文缩写按活清单编译为 Cartesia spell 标签", async () => {
    const directory = await mkdtemp(join(tmpdir(), "knowledge-explainer-cartesia-"));
    temporaryDirectories.push(directory);
    let body: Record<string, unknown> | undefined;
    const fetchTransport: FetchTransport = async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(new Uint8Array([1]), { status: 200 });
    };
    const pronunciationCatalog = CartesiaPronunciationCatalogSchema.parse({
      kind: "cartesia-pronunciation-catalog",
      dictionary: { name: "Knowledge Explainer", description: "测试" },
      entries: [{ id: "gpt", text: "GPT", language: "en", notation: "spell", applicationScenarios: ["缩写"] }]
    });

    await createGateway(fetchTransport, pronunciationCatalog).synthesizeNarration({
      segments: [{ text: "GPT is useful." }],
      outputPath: join(directory, "narration.wav"),
      format: "wav",
      language: "en"
    });

    expect(body?.transcript).toBe("<spell>GPT</spell> is useful.");
  });
});
