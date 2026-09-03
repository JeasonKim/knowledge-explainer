export type NarratedTimelineBeat = {
  id: string;
  narrationText: string;
};

export type NarrationTimelineRange = {
  startFrame: number;
  endFrame: number;
};

function narrationWeight(beat: NarratedTimelineBeat): number {
  const spokenCharacters = beat.narrationText.replace(/\s/g, "").length;
  return Math.max(1, spokenCharacters);
}

export function allocateNarrationTimeline(
  beats: NarratedTimelineBeat[],
  durationInFrames: number
): NarrationTimelineRange[] {
  const totalWeight = beats.reduce((total, beat) => total + narrationWeight(beat), 0);
  let consumedFrames = 0;

  return beats.map((beat, index) => {
    const startFrame = consumedFrames;
    const isFinalBeat = index === beats.length - 1;
    const weightedFrames = Math.max(1, Math.round((narrationWeight(beat) / totalWeight) * durationInFrames));
    const endFrame = isFinalBeat
      ? durationInFrames
      : Math.min(durationInFrames - (beats.length - index - 1), startFrame + weightedFrames);
    consumedFrames = endFrame;
    return { startFrame, endFrame };
  });
}
