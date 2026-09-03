import { describe, expect, it } from "vitest";
import { parseIllustrationSheetIngestionRequest } from "./illustration-sheet-ingestion-request";

describe("parseIllustrationSheetIngestionRequest", () => {
  it("要求调用方明确提供工程资源和插图索引位置", () => {
    expect(() => parseIllustrationSheetIngestionRequest([
      "--source", "sheet.png",
      "--manifest", "manifest.yaml"
    ])).toThrow("--catalog");
  });

  it("保留调用方指定的位置，不推断宿主工程目录", () => {
    expect(parseIllustrationSheetIngestionRequest([
      "--source", "sheet.png",
      "--manifest", "manifest.yaml",
      "--catalog", "data/illustrations.yaml",
      "--asset-root", "static"
    ])).toMatchObject({
      catalogPath: "data/illustrations.yaml",
      assetRootDirectory: "static",
      dryRun: false
    });
  });

  it("只有显式声明时才允许刷新同一批次的已有资源", () => {
    expect(parseIllustrationSheetIngestionRequest([
      "--source", "sheet.png",
      "--manifest", "manifest.yaml",
      "--catalog", "data/illustrations.yaml",
      "--asset-root", "static",
      "--refresh-existing-batch"
    ])).toMatchObject({
      refreshExistingBatch: true
    });
  });
});
