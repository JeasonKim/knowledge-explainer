import { describe, expect, it } from "vitest";
import { presentCaseAsset, presentCreationMethodExperience } from "./creation-method-presentation";

describe("知识讲解调试器呈现", () => {
  it("只登记知识讲解能力与通用案例素材", () => {
    const experience = presentCreationMethodExperience("knowledge-explainer");
    expect(experience.previewStates.map((state) => state.id)).toEqual(["theme-cover", "content", "theme-closing"]);
    expect(presentCaseAsset("knowledge-explainer", "scene.illustration")).toBe("/cases/knowledge-learning-map.png");
  });
});
