import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { VolcengineTtsGateway, type FetchTransport } from "./volcengine-tts-gateway";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

type CapturedFetchRequest = { url: string; init: RequestInit | undefined };

function createGateway(fetchTransport: FetchTransport): VolcengineTtsGateway {
  return new VolcengineTtsGateway({
    apiKey: "test-key",
    voiceId: "example-volcengine-voice",
    resourceId: "seed-icl-2.0",
    endpoint: "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
    audio: { format: "wav", sampleRate: 24000 },
    language: "zh",
    synthesis: { emotion: "contemplative", speed: 1.12, volume: 0.94 },
    explicitLanguage: "zh",
    voiceInstruction: "适合高质量中文知识短视频口播。"
  }, fetchTransport);
}

describe("VolcengineTtsGateway", () => {
  it("将连续口播映射为豆包 TTS 2.0 V3 请求，并合并 NDJSON 音频分片", async () => {
    const directory = await mkdtemp(join(tmpdir(), "knowledge-explainer-volcengine-"));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, "narration.wav");
    let capturedRequest: CapturedFetchRequest | undefined;
    const fetchTransport: FetchTransport = async (input, init) => {
      capturedRequest = { url: String(input), init };
      return new Response([
        JSON.stringify({ code: 20000000, data: Buffer.from([1, 2]).toString("base64") }),
        JSON.stringify({ code: 20000000, data: Buffer.from([3, 4]).toString("base64") })
      ].join("\n"), { status: 200 });
    };

    const result = await createGateway(fetchTransport).synthesizeNarration({
      segments: [{ text: "第一句，带自然停顿。第二句继续完整表达。" }],
      outputPath,
      format: "wav"
    });

    expect(capturedRequest?.url).toBe("https://openspeech.bytedance.com/api/v3/tts/unidirectional");
    expect(capturedRequest?.init?.headers).toMatchObject({
      "X-Api-Key": "test-key",
      "X-Api-Resource-Id": "seed-icl-2.0",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(capturedRequest?.init?.body))).toEqual({
      user: { uid: "knowledge-explainer" },
      req_params: {
        text: "第一句，带自然停顿。第二句继续完整表达。",
        speaker: "example-volcengine-voice",
        audio_params: { format: "wav", sample_rate: 24000 },
        speed_ratio: 1.12,
        volume_ratio: 0.94,
        additions: "{\"explicit_language\":\"zh\"}",
        voice_instruction: "适合高质量中文知识短视频口播。请用沉静、有思考感的口吻，节奏从容，不煽情。"
      }
    });
    expect(capturedRequest?.init?.headers).toHaveProperty("X-Api-Request-Id");
    await expect(readFile(outputPath)).resolves.toEqual(Buffer.from([1, 2, 3, 4]));
    expect(result).toEqual({ provider: "volcengine", audioPath: outputPath, format: "wav" });
  });

  it("拒绝失败事件和空音频，避免把错误响应伪装为成片音频", async () => {
    const directory = await mkdtemp(join(tmpdir(), "knowledge-explainer-volcengine-"));
    temporaryDirectories.push(directory);
    const gateway = createGateway(async () => new Response(
      JSON.stringify({ code: 500, message: "voice is not authorized" }),
      { status: 200 }
    ));

    await expect(gateway.synthesizeNarration({
      segments: [{ text: "测试。" }],
      outputPath: join(directory, "failed.wav"),
      format: "wav"
    })).rejects.toThrow("voice is not authorized");
  });
});
