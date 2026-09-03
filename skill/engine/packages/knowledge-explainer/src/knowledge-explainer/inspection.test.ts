import { describe, expect, it } from "vitest";
import type { KnowledgeExplainerProductionLock } from "@knowledge-explainer/contracts";
import { planKnowledgeExplainerInspectionFrames } from "./inspection";

const project = {
  durationInFrames: 102,
  framing: {
    introDurationInFrames: 12,
    outroDurationInFrames: 30
  },
  scenes: [{
    id: "hook",
    startFrame: 12,
    endFrame: 72
  }]
} as KnowledgeExplainerProductionLock;

describe("planKnowledgeExplainerInspectionFrames", () => {
  it("把成片真实首帧和真实尾帧纳入固定验收", () => {
    expect(planKnowledgeExplainerInspectionFrames(project)).toEqual([
      { shotId: "theme-cover", phase: "cover", frame: 0 },
      { shotId: "hook", phase: "scene-start", frame: 12 },
      { shotId: "hook", phase: "scene-middle", frame: 41 },
      { shotId: "hook", phase: "scene-end", frame: 71 },
      { shotId: "theme-closing", phase: "closing", frame: 101 }
    ]);
  });
});
