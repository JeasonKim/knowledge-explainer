import { describe, expect, it } from "vitest";
import { buildIllustrationSheetIngestionPlan, type IllustrationSheetManifest } from "./illustration-sheet-plan";

const manifest: IllustrationSheetManifest = {
  kind: "illustration-sheet-manifest",
  batchId: "impermanence-v1",
  systemId: "knowledge-ink-linework-v1",
  cells: [{
    assetId: "overwhelmed-question",
    fileName: "overwhelmed",
    subject: "一个人面对巨大的问号",
    visualMetaphor: "问题堆积",
    composition: "balanced",
    applicationScenarios: ["问题开场"],
    tags: ["问题"],
    grid: { row: 0, column: 0 }
  }]
};

describe("buildIllustrationSheetIngestionPlan", () => {
  it("把固定网格位置编译为确定性裁切坐标和项目资源路径", () => {
    expect(buildIllustrationSheetIngestionPlan(manifest, { width: 1536, height: 1024 })).toMatchObject({
      sourceAssetPath: "illustrations/knowledge-explainer/sheets/impermanence-v1.png",
      cellWidth: 512,
      cellHeight: 512,
      cells: [{
        assetPath: "illustrations/knowledge-explainer/overwhelmed.png",
        crop: { width: 512, height: 512, x: 0, y: 0 }
      }]
    });
  });

  it("拒绝不规则母版和重复格位，避免切分后悄悄覆盖资源", () => {
    expect(() => buildIllustrationSheetIngestionPlan(manifest, { width: 1501, height: 1024 }))
      .toThrow("must divide evenly");
    expect(() => buildIllustrationSheetIngestionPlan({
      ...manifest,
      cells: [...manifest.cells, { ...manifest.cells[0]!, assetId: "duplicate", fileName: "duplicate" }]
    }, { width: 1536, height: 1024 })).toThrow("multiple assets to grid cell");
  });
});
