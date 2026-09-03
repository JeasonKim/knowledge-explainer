import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MacosSayTtsGateway } from "./macos-say-tts-gateway";

describe("MacosSayTtsGateway", () => {
  it("把统一语速和音量映射到 say 与 ffmpeg，并保持连续正文", async () => {
    const directory = await mkdtemp(join(tmpdir(), "knowledge-explainer-macos-say-"));
    const outputPath = join(directory, "narration.wav");
    const commands: Array<{ executable: string; arguments: string[] }> = [];
    let spokenText = "";
    const executeFile = vi.fn(async (executable: string, argumentsList: string[]) => {
      commands.push({ executable, arguments: argumentsList });
      if (executable === "say") {
        const scriptFlag = argumentsList.indexOf("-f");
        spokenText = await readFile(argumentsList[scriptFlag + 1]!, "utf8");
      }
    });
    try {
      const gateway = new MacosSayTtsGateway({
        voiceId: "Reed (Chinese (China mainland))",
        synthesis: { emotion: "content", speed: 1.1, volume: 0.9 },
        executeFile
      });
      const result = await gateway.synthesizeNarration({
        segments: [{ text: "第一句。" }, { text: "第二句。" }],
        outputPath,
        format: "wav",
        language: "zh"
      });

      expect(result).toEqual({
        provider: "macos-say",
        audioPath: outputPath,
        format: "wav"
      });
      expect(commands[0]).toMatchObject({
        executable: "say",
        arguments: expect.arrayContaining([
          "-v", "Reed (Chinese (China mainland))",
          "-r", "198"
        ])
      });
      expect(spokenText).toBe("第一句。第二句。");
      expect(commands[1]).toMatchObject({
        executable: "ffmpeg",
        arguments: expect.arrayContaining(["-af", "volume=0.9", outputPath])
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("拒绝非中文和非 wav 输出", async () => {
    const gateway = new MacosSayTtsGateway({
      voiceId: "Reed (Chinese (China mainland))",
      synthesis: { emotion: "neutral", speed: 1, volume: 1 },
      executeFile: vi.fn()
    });

    await expect(gateway.synthesizeNarration({
      segments: [{ text: "hello" }],
      outputPath: "/tmp/english.wav",
      format: "wav",
      language: "en"
    })).rejects.toThrow("only supports language=zh");
    await expect(gateway.synthesizeNarration({
      segments: [{ text: "你好" }],
      outputPath: "/tmp/chinese.mp3",
      format: "mp3",
      language: "zh"
    })).rejects.toThrow("only supports format=wav");
  });
});
