import type { NarrationTimingMap } from "@knowledge-explainer/contracts";

export const narrationTimingToleranceMs = 20;

export type NarrationAssetSynchronization = {
  audioDurationMs: number;
  timingMap: NarrationTimingMap;
  toleranceMs?: number;
};

export function assertNarrationAssetsSynchronized(
  synchronization: NarrationAssetSynchronization
): void {
  const toleranceMs = synchronization.toleranceMs ?? narrationTimingToleranceMs;
  if (!Number.isInteger(synchronization.audioDurationMs) || synchronization.audioDurationMs <= 0) {
    throw new Error(`Narration audio duration must be a positive integer, received ${synchronization.audioDurationMs}.`);
  }
  if (!Number.isInteger(toleranceMs) || toleranceMs < 0) {
    throw new Error(`Narration timing tolerance must be a non-negative integer, received ${toleranceMs}.`);
  }
  const differenceMs = Math.abs(synchronization.audioDurationMs - synchronization.timingMap.durationMs);
  if (differenceMs > toleranceMs) {
    throw new Error(
      `Narration audio duration ${synchronization.audioDurationMs}ms does not match measured timing map ${synchronization.timingMap.durationMs}ms within ${toleranceMs}ms.`
    );
  }
}
