import type { LocalAlignmentTimedToken } from "@knowledge-explainer/narration";

type JsonRecord = Record<string, unknown>;

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFiniteOffset(offsets: JsonRecord, field: "from" | "to", tokenIndex: number): number {
  const value = offsets[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Whisper transcription token ${tokenIndex} offsets.${field} must be a finite number.`);
  }
  return value;
}

/**
 * whisper.cpp 的 JSON 以毫秒 offsets 表示词级时间。这里只解析稳定字段，拒绝用缺失时间的识别文本继续发布流程。
 */
export function parseWhisperTranscriptionTokens(input: unknown): LocalAlignmentTimedToken[] {
  if (!isJsonRecord(input) || !Array.isArray(input.transcription)) {
    throw new Error("Whisper transcription JSON requires a transcription array.");
  }
  const tokens = input.transcription.flatMap((entry, tokenIndex) => {
    if (!isJsonRecord(entry)) {
      throw new Error(`Whisper transcription token ${tokenIndex} must be an object.`);
    }
    if (typeof entry.text !== "string") {
      throw new Error(`Whisper transcription token ${tokenIndex} requires text.`);
    }
    if (entry.text.trim().length === 0) {
      return [];
    }
    if (!isJsonRecord(entry.offsets)) {
      throw new Error(`Whisper transcription token ${tokenIndex} requires offsets.`);
    }
    const startMs = readFiniteOffset(entry.offsets, "from", tokenIndex);
    const endMs = readFiniteOffset(entry.offsets, "to", tokenIndex);
    if (startMs < 0 || endMs < startMs) {
      throw new Error(`Whisper transcription token ${tokenIndex} has an invalid offset range.`);
    }
    return [{ text: entry.text, startMs, endMs }];
  });
  if (tokens.length === 0) {
    throw new Error("Whisper transcription JSON contains no timed tokens.");
  }
  return tokens;
}
