import { describe, expect, it } from "vitest";
import { CartesiaPronunciationCatalogSchema } from "@knowledge-explainer/contracts";
import { applyCartesiaSpellCorrections, selectCartesiaDictionaryEntries } from "./apply-cartesia-pronunciation-corrections";

const catalog = CartesiaPronunciationCatalogSchema.parse({
  kind: "cartesia-pronunciation-catalog",
  dictionary: { name: "Knowledge Explainer", description: "测试词典" },
  entries: [
    {
      id: "zh-wei-bo",
      text: "微博",
      language: "zh",
      notation: "sounds-like",
      pronunciation: "wei bo",
      applicationScenarios: ["中文平台名称"]
    },
    {
      id: "en-gpt",
      text: "GPT",
      language: "en",
      notation: "spell",
      applicationScenarios: ["英文缩写"]
    },
    {
      id: "en-hidden",
      text: "skipme",
      language: "en",
      notation: "sounds-like",
      pronunciation: "skip me",
      applicationScenarios: ["停用项"],
      status: "disabled"
    }
  ]
});

describe("Cartesia 发音纠正编译", () => {
  it("只同步当前语言的启用词典项，并保留 Cartesia 别名", () => {
    expect(selectCartesiaDictionaryEntries(catalog, "zh")).toEqual([
      { text: "微博", alias: "wei bo", entryId: "zh-wei-bo" }
    ]);
  });

  it("只对当前语言的缩写插入官方 spell 标记", () => {
    expect(applyCartesiaSpellCorrections("GPT 和微博都要读对。", catalog, "en")).toEqual({
      transcript: "<spell>GPT</spell> 和微博都要读对。",
      appliedEntryIds: ["en-gpt"]
    });
    expect(applyCartesiaSpellCorrections("GPT 和微博都要读对。", catalog, "zh")).toEqual({
      transcript: "GPT 和微博都要读对。",
      appliedEntryIds: []
    });
  });
});
