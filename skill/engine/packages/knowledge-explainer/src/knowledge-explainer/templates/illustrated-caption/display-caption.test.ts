import { describe, expect, it } from "vitest";
import { hasKnowledgeExplainerDisplayPunctuation } from "./display-caption";

describe("hasKnowledgeExplainerDisplayPunctuation", () => {
  it("识别中英文标点且不把展示换行当成标点", () => {
    expect(hasKnowledgeExplainerDisplayPunctuation("我很好，\n真的吗Yes!"))
      .toBe(true);
    expect(hasKnowledgeExplainerDisplayPunctuation("我很好\n真的吗Yes"))
      .toBe(false);
  });
});
