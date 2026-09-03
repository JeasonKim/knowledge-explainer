import { describe, expect, it } from "vitest";
import { parseWhisperTranscriptionTokens } from "./parse-whisper-transcription";

describe("parseWhisperTranscriptionTokens", () => {
  it("读取 whisper.cpp 的逐词时间输出，并保留多字 token 的完整时间范围", () => {
    const tokens = parseWhisperTranscriptionTokens({
      transcription: [{
        text: "问题",
        offsets: { from: 120, to: 460 }
      }, {
        text: " ",
        offsets: { from: 460, to: 500 }
      }, {
        text: "变了",
        offsets: { from: 600, to: 880 }
      }]
    });

    expect(tokens).toEqual([
      { text: "问题", startMs: 120, endMs: 460 },
      { text: "变了", startMs: 600, endMs: 880 }
    ]);
  });

  it("拒绝缺失 offsets 的 Whisper 输出，避免把不完整识别结果作为时间轴依据", () => {
    expect(() => parseWhisperTranscriptionTokens({
      transcription: [{ text: "问题" }]
    })).toThrow("offsets");
  });
});
