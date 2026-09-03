import { describe, expect, it } from "vitest";
import { resolveKnowledgeExplainerFramingDuration } from "./framing-contract";

describe("resolveKnowledgeExplainerFramingDuration", () => {
  it("把封面限制为半秒，并保留 1.25 秒收束页", () => {
    expect(resolveKnowledgeExplainerFramingDuration(24)).toEqual({
      introDurationInFrames: 12,
      outroDurationInFrames: 30
    });
  });
});
