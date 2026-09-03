import type { NarrationTimingMap } from "@knowledge-explainer/contracts";
import type { NarrationTimelineRange } from "./allocate-narration-timeline";

export type TimedNarrationCard = {
  id: string;
};

export type MeasuredNarrationTimeline = {
  durationInFrames: number;
  ranges: NarrationTimelineRange[];
};

function millisecondsToFrame(milliseconds: number, framesPerSecond: number): number {
  return Math.round((milliseconds / 1000) * framesPerSecond);
}

export function resolveMeasuredNarrationTimeline(
  cards: TimedNarrationCard[],
  timingMap: NarrationTimingMap,
  framesPerSecond: number
): MeasuredNarrationTimeline {
  if (!Number.isInteger(framesPerSecond) || framesPerSecond <= 0) {
    throw new Error("framesPerSecond must be a positive integer.");
  }
  if (cards.length !== timingMap.segments.length) {
    throw new Error(
      `KnowledgeExplainer cards count ${cards.length} does not match measured narration segment count ${timingMap.segments.length}.`
    );
  }

  const durationInFrames = Math.max(1, Math.ceil((timingMap.durationMs / 1000) * framesPerSecond));
  let previousEndFrame = 0;
  const ranges = cards.map((card, index) => {
    const timingSegment = timingMap.segments[index];
    if (!timingSegment) {
      throw new Error(`Missing measured narration segment for knowledge explainer card ${card.id}.`);
    }
    if (timingSegment.id !== card.id) {
      throw new Error(
        `KnowledgeExplainer card ${card.id} does not match measured narration segment ${timingSegment.id} at index ${index}.`
      );
    }

    const isFinalCard = index === cards.length - 1;
    const requestedEndFrame = isFinalCard
      ? durationInFrames
      : millisecondsToFrame(timingSegment.endMs, framesPerSecond);
    const remainingCardCount = cards.length - index - 1;
    const endFrame = Math.min(
      durationInFrames - remainingCardCount,
      Math.max(previousEndFrame + 1, requestedEndFrame)
    );
    const range = { startFrame: previousEndFrame, endFrame };
    previousEndFrame = endFrame;
    return range;
  });

  return { durationInFrames, ranges };
}
