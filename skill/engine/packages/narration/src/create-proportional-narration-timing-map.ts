import {
  NarrationTimingMapSchema,
  type NarrationTimingMap
} from "@knowledge-explainer/contracts";

export type ProportionalNarrationTimingBeat = {
  id: string;
  narrationText: string;
};

export type ProportionalNarrationTimingMapRequest = {
  durationMs: number;
  beats: ProportionalNarrationTimingBeat[];
};

function narrationWeight(narrationText: string): number {
  return Math.max(1, narrationText.replace(/\s/g, "").length);
}

/**
 * 在尚未进行逐字对齐时，用整条音频的实测总时长为边界，为视觉卡片生成临时区间。
 * 该结果必须标记为 measured-total-duration，不能被误认为逐卡实测或强制对齐结果。
 */
export function createProportionalNarrationTimingMap(
  request: ProportionalNarrationTimingMapRequest
): NarrationTimingMap {
  if (!Number.isInteger(request.durationMs) || request.durationMs <= 0) {
    throw new Error("Narration durationMs must be a positive integer.");
  }
  if (request.beats.length === 0) {
    throw new Error("Narration timing requires at least one beat.");
  }
  if (request.durationMs < request.beats.length) {
    throw new Error("Narration durationMs must be at least the number of beats.");
  }

  const totalWeight = request.beats.reduce((total, beat) => total + narrationWeight(beat.narrationText), 0);
  let cursorMs = 0;
  const segments = request.beats.map((beat, index) => {
    const remainingBeatCount = request.beats.length - index - 1;
    const isFinalBeat = index === request.beats.length - 1;
    const allocatedDurationMs = isFinalBeat
      ? request.durationMs - cursorMs
      : Math.max(
          1,
          Math.min(
            request.durationMs - cursorMs - remainingBeatCount,
            Math.round((narrationWeight(beat.narrationText) / totalWeight) * request.durationMs)
          )
        );
    const startMs = cursorMs;
    const endMs = startMs + allocatedDurationMs;
    cursorMs = endMs;
    return { id: beat.id, startMs, speechEndMs: endMs, endMs };
  });

  return NarrationTimingMapSchema.parse({
    kind: "narration-timing-map",
    source: "measured-total-duration",
    durationMs: request.durationMs,
    segments
  });
}
