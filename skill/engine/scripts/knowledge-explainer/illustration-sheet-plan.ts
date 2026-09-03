export type IllustrationSheetSpec = {
  columns: number;
  rows: number;
  chromaKeyColor: string;
  chromaKeySimilarity: number;
  chromaKeyBlend: number;
  illustrationDirectory: string;
  sourceSheetDirectory: string;
};

/**
 * 知识讲解模板的插画母版是固定资产格式，不向单期创作开放配置。
 */
export const knowledgeExplainerIllustrationSheetSpec: IllustrationSheetSpec = {
  columns: 3,
  rows: 2,
  chromaKeyColor: "#00FF00",
  chromaKeySimilarity: 0.12,
  chromaKeyBlend: 0,
  illustrationDirectory: "illustrations/knowledge-explainer",
  sourceSheetDirectory: "illustrations/knowledge-explainer/sheets"
};

export type IllustrationSheetCell = {
  assetId: string;
  fileName: string;
  subject: string;
  visualMetaphor: string;
  composition: "wide" | "balanced" | "tall";
  applicationScenarios: string[];
  tags: string[];
  grid: { row: number; column: number };
};

export type IllustrationSheetManifest = {
  kind: "illustration-sheet-manifest";
  batchId: string;
  systemId: string;
  cells: IllustrationSheetCell[];
};

export type IllustrationSheetIngestionPlan = {
  batchId: string;
  sourceAssetPath: string;
  cellWidth: number;
  cellHeight: number;
  cells: Array<IllustrationSheetCell & {
    assetPath: string;
    crop: { width: number; height: number; x: number; y: number };
  }>;
};

function ensurePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

/**
 * 母版网格和资源路径由静态规范决定；运行计划只把已审核的格位映射为确定性裁切坐标。
 */
export function buildIllustrationSheetIngestionPlan(
  manifest: IllustrationSheetManifest,
  sourceDimensions: { width: number; height: number }
): IllustrationSheetIngestionPlan {
  const spec = knowledgeExplainerIllustrationSheetSpec;
  ensurePositiveInteger(spec.columns, "illustration sheet column count");
  ensurePositiveInteger(spec.rows, "illustration sheet row count");
  ensurePositiveInteger(sourceDimensions.width, "source sheet width");
  ensurePositiveInteger(sourceDimensions.height, "source sheet height");
  if (sourceDimensions.width % spec.columns !== 0 || sourceDimensions.height % spec.rows !== 0) {
    throw new Error(
      `Source sheet ${sourceDimensions.width}x${sourceDimensions.height} must divide evenly into ${spec.columns}x${spec.rows} cells.`
    );
  }
  if (manifest.cells.length === 0) {
    throw new Error("Illustration sheet manifest requires at least one cell.");
  }

  const assetIds = new Set<string>();
  const fileNames = new Set<string>();
  const gridCells = new Set<string>();
  const cellWidth = sourceDimensions.width / spec.columns;
  const cellHeight = sourceDimensions.height / spec.rows;
  const cells = manifest.cells.map((cell) => {
    if (assetIds.has(cell.assetId)) {
      throw new Error(`Illustration sheet manifest has duplicate assetId ${cell.assetId}.`);
    }
    assetIds.add(cell.assetId);
    if (fileNames.has(cell.fileName)) {
      throw new Error(`Illustration sheet manifest has duplicate fileName ${cell.fileName}.`);
    }
    fileNames.add(cell.fileName);
    if (cell.grid.row < 0 || cell.grid.row >= spec.rows || cell.grid.column < 0 || cell.grid.column >= spec.columns) {
      throw new Error(`Illustration asset ${cell.assetId} points outside the ${spec.columns}x${spec.rows} grid.`);
    }
    const gridKey = `${cell.grid.row}:${cell.grid.column}`;
    if (gridCells.has(gridKey)) {
      throw new Error(`Illustration sheet manifest maps multiple assets to grid cell ${gridKey}.`);
    }
    gridCells.add(gridKey);
    return {
      ...cell,
      assetPath: `${spec.illustrationDirectory}/${cell.fileName}.png`,
      crop: {
        width: cellWidth,
        height: cellHeight,
        x: cell.grid.column * cellWidth,
        y: cell.grid.row * cellHeight
      }
    };
  });

  return {
    batchId: manifest.batchId,
    sourceAssetPath: `${spec.sourceSheetDirectory}/${manifest.batchId}.png`,
    cellWidth,
    cellHeight,
    cells
  };
}
