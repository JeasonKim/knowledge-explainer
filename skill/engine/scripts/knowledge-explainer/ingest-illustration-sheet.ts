import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  buildIllustrationSheetIngestionPlan,
  knowledgeExplainerIllustrationSheetSpec,
  type IllustrationSheetCell,
  type IllustrationSheetManifest
} from "./illustration-sheet-plan";
import {
  assertKnowledgeExplainerIllustrationAspectRatio,
  knowledgeExplainerIllustrationSubjectSpec,
  resolveIllustrationSubjectCrop,
  type IllustrationSubjectBounds
} from "./illustration-subject-normalization";
import {
  parseIllustrationSheetIngestionRequest,
  type IllustrationSheetIngestionRequest
} from "./illustration-sheet-ingestion-request";

type ImageDimensions = { width: number; height: number; pixelFormat: string };

type ChildCommand = {
  executable: string;
  arguments: string[];
};

type ChildCommandResult = {
  stdout: string;
  stderr: string;
};

type IllustrationCatalogEntry = {
  id: string;
  assetPath: string;
  systemId: string;
  subject: string;
  visualMetaphor: string;
  composition: IllustrationSheetCell["composition"];
  applicationScenarios: string[];
  tags: string[];
  status: "approved";
  sheetOrigin: {
    batchId: string;
    sourceAssetPath: string;
    grid: { row: number; column: number };
  };
};

type IllustrationCatalog = Record<string, unknown> & {
  kind: "knowledge-explainer-illustration-catalog";
  entries: Array<Record<string, unknown> & { id: string; assetPath: string }>;
};

const sheetCellEdgeTrimPixels = 4;

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  return value.map((item, index) => requireString(item, `${label}[${index}]`));
}

function parseGrid(value: unknown, label: string): { row: number; column: number } {
  const grid = requireRecord(value, label);
  return {
    row: requireNumber(grid.row, `${label}.row`),
    column: requireNumber(grid.column, `${label}.column`)
  };
}

function parseIllustrationCell(value: unknown, index: number): IllustrationSheetCell {
  const cell = requireRecord(value, `manifest.cells[${index}]`);
  const composition = requireString(cell.composition, `manifest.cells[${index}].composition`);
  if (composition !== "wide" && composition !== "balanced" && composition !== "tall") {
    throw new Error(`manifest.cells[${index}].composition must be wide, balanced, or tall.`);
  }
  return {
    assetId: requireString(cell.assetId, `manifest.cells[${index}].assetId`),
    fileName: requireString(cell.fileName, `manifest.cells[${index}].fileName`),
    subject: requireString(cell.subject, `manifest.cells[${index}].subject`),
    visualMetaphor: requireString(cell.visualMetaphor, `manifest.cells[${index}].visualMetaphor`),
    composition,
    applicationScenarios: requireStringArray(cell.applicationScenarios, `manifest.cells[${index}].applicationScenarios`),
    tags: requireStringArray(cell.tags, `manifest.cells[${index}].tags`),
    grid: parseGrid(cell.grid, `manifest.cells[${index}].grid`)
  };
}

function parseManifest(value: unknown): IllustrationSheetManifest {
  const manifest = requireRecord(value, "illustration sheet manifest");
  if (manifest.kind !== "illustration-sheet-manifest") {
    throw new Error("Illustration sheet manifest must declare kind=illustration-sheet-manifest.");
  }
  if ("version" in manifest) {
    throw new Error("Illustration sheet manifest does not use a version field.");
  }
  if (!Array.isArray(manifest.cells)) {
    throw new Error("illustration sheet manifest.cells must be an array.");
  }
  return {
    kind: "illustration-sheet-manifest",
    batchId: requireString(manifest.batchId, "manifest.batchId"),
    systemId: requireString(manifest.systemId, "manifest.systemId"),
    cells: manifest.cells.map(parseIllustrationCell)
  };
}

function parseIllustrationCatalog(value: unknown): IllustrationCatalog {
  const catalog = requireRecord(value, "illustration catalog");
  if (catalog.kind !== "knowledge-explainer-illustration-catalog" || !Array.isArray(catalog.entries)) {
    throw new Error("Illustration catalog must declare kind=knowledge-explainer-illustration-catalog and an entries array.");
  }
  return {
    ...catalog,
    kind: "knowledge-explainer-illustration-catalog",
    entries: catalog.entries.map((entry, index) => {
      const record = requireRecord(entry, `illustration catalog entries[${index}]`);
      return {
        ...record,
        id: requireString(record.id, `illustration catalog entries[${index}].id`),
        assetPath: requireString(record.assetPath, `illustration catalog entries[${index}].assetPath`)
      };
    })
  };
}

async function loadYaml(path: string): Promise<unknown> {
  return parseYaml(await readFile(path, "utf8"));
}

async function readImageDimensions(path: string): Promise<ImageDimensions> {
  const output = await runChildCommand({
    executable: "ffprobe",
    arguments: [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,pix_fmt", "-of", "json", path
    ]
  });
  const probe = JSON.parse(output) as { streams?: Array<{ width?: unknown; height?: unknown; pix_fmt?: unknown }> };
  const stream = probe.streams?.[0];
  if (!stream || typeof stream.width !== "number" || typeof stream.height !== "number" || typeof stream.pix_fmt !== "string") {
    throw new Error(`Could not read image dimensions for ${path}.`);
  }
  return { width: stream.width, height: stream.height, pixelFormat: stream.pix_fmt };
}

function executeChildCommand(command: ChildCommand): Promise<ChildCommandResult> {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command.executable, command.arguments, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", (error) => {
      console.warn(`[knowledge-explainer] command could not start executable=${command.executable}. ${error.message}`);
      rejectCommand(error);
    });
    child.once("exit", (exitCode) => {
      if (exitCode === 0) {
        resolveCommand({ stdout, stderr });
        return;
      }
      const details = stderr.trim().replace(/\s+/g, " ").slice(0, 500);
      const error = new Error(`Image processing command failed executable=${command.executable} exit=${exitCode ?? "unknown"}${details ? ` stderr=${details}` : ""}.`);
      console.warn(`[knowledge-explainer] ${error.message}`);
      rejectCommand(error);
    });
  });
}

async function runChildCommand(command: ChildCommand): Promise<string> {
  return (await executeChildCommand(command)).stdout;
}

async function detectIllustrationSubjectBounds(path: string): Promise<IllustrationSubjectBounds> {
  const result = await executeChildCommand({
    executable: "ffmpeg",
    arguments: [
      "-hide_banner",
      "-loglevel", "info",
      "-i", path,
      "-vf", `alphaextract,bbox=min_val=${knowledgeExplainerIllustrationSubjectSpec.alphaThreshold}`,
      "-frames:v", "1",
      "-f", "null",
      "-"
    ]
  });
  const matches = [...result.stderr.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)];
  const match = matches.at(-1);
  if (!match) {
    throw new Error(`Could not detect a non-transparent illustration subject in ${path}.`);
  }
  return {
    width: Number(match[1]),
    height: Number(match[2]),
    x: Number(match[3]),
    y: Number(match[4])
  };
}

function buildCatalogEntries(
  manifest: IllustrationSheetManifest,
  sourceAssetPath: string,
  cells: ReturnType<typeof buildIllustrationSheetIngestionPlan>["cells"]
): IllustrationCatalogEntry[] {
  return cells.map((cell) => ({
    id: cell.assetId,
    assetPath: cell.assetPath,
    systemId: manifest.systemId,
    subject: cell.subject,
    visualMetaphor: cell.visualMetaphor,
    composition: cell.composition,
    applicationScenarios: cell.applicationScenarios,
    tags: cell.tags,
    status: "approved",
    sheetOrigin: {
      batchId: manifest.batchId,
      sourceAssetPath,
      grid: cell.grid
    }
  }));
}

function assertCatalogCanRegister(
  catalog: IllustrationCatalog,
  entries: IllustrationCatalogEntry[]
): void {
  const knownIds = new Set(catalog.entries.map((entry) => entry.id));
  const knownPaths = new Set(catalog.entries.map((entry) => entry.assetPath));
  for (const entry of entries) {
    if (knownIds.has(entry.id)) {
      throw new Error(`Illustration catalog already contains asset id ${entry.id}.`);
    }
    if (knownPaths.has(entry.assetPath)) {
      throw new Error(`Illustration catalog already contains asset path ${entry.assetPath}.`);
    }
  }
}

function assertCatalogCanRefreshBatch(
  catalog: IllustrationCatalog,
  entries: IllustrationCatalogEntry[]
): void {
  const knownEntries = new Map(catalog.entries.map((entry) => [entry.id, entry]));
  for (const entry of entries) {
    const knownEntry = knownEntries.get(entry.id);
    if (!knownEntry) {
      throw new Error(`Cannot refresh unregistered illustration asset ${entry.id}.`);
    }
    if (knownEntry.assetPath !== entry.assetPath) {
      throw new Error(
        `Cannot refresh illustration asset ${entry.id}: catalog path ${knownEntry.assetPath} != manifest path ${entry.assetPath}.`
      );
    }
    const sheetOrigin = requireRecord(knownEntry.sheetOrigin, `illustration catalog entry ${entry.id}.sheetOrigin`);
    if (sheetOrigin.batchId !== entry.sheetOrigin.batchId) {
      throw new Error(
        `Cannot refresh illustration asset ${entry.id}: catalog batch ${String(sheetOrigin.batchId)} != ` +
        `manifest batch ${entry.sheetOrigin.batchId}.`
      );
    }
  }
}

async function assertFileDoesNotExist(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    return;
  }
  throw new Error(`Refusing to overwrite existing illustration resource ${path}.`);
}

async function renderIllustrationCell(
  sourcePath: string,
  outputPath: string,
  crop: { width: number; height: number; x: number; y: number }
): Promise<void> {
  const spec = knowledgeExplainerIllustrationSheetSpec;
  const temporaryChromaOutputPath = `${outputPath}.tmp-${process.pid}-chroma.png`;
  const temporaryNormalizedOutputPath = `${outputPath}.tmp-${process.pid}-normalized.png`;
  const color = `0x${spec.chromaKeyColor.slice(1)}`;
  const contentWidth = crop.width - sheetCellEdgeTrimPixels * 2;
  const contentHeight = crop.height - sheetCellEdgeTrimPixels * 2;
  if (contentWidth <= 0 || contentHeight <= 0) {
    throw new Error(`Illustration crop ${crop.width}x${crop.height} is too small for the ${sheetCellEdgeTrimPixels}px sheet edge trim.`);
  }
  const filter = [
    `crop=${contentWidth}:${contentHeight}:${crop.x + sheetCellEdgeTrimPixels}:${crop.y + sheetCellEdgeTrimPixels}`,
    `colorkey=${color}:${spec.chromaKeySimilarity}:${spec.chromaKeyBlend}`,
    "despill=type=green:mix=1:expand=0.25",
    `scale=${crop.width}:${crop.height}:flags=lanczos`,
    "format=rgba"
  ].join(",");
  try {
    await runChildCommand({
      executable: "ffmpeg",
      arguments: ["-hide_banner", "-loglevel", "error", "-y", "-i", sourcePath, "-vf", filter, "-frames:v", "1", temporaryChromaOutputPath]
    });
    const chromaDimensions = await readImageDimensions(temporaryChromaOutputPath);
    if (chromaDimensions.width !== crop.width || chromaDimensions.height !== crop.height || !chromaDimensions.pixelFormat.includes("a")) {
      throw new Error(
        `Chroma-keyed illustration ${outputPath} must be ${crop.width}x${crop.height} with alpha, received ` +
        `${chromaDimensions.width}x${chromaDimensions.height} ${chromaDimensions.pixelFormat}.`
      );
    }

    // 透明主体边界是最终资源尺寸的唯一依据，避免把母版格位的大面积留白带入模板。
    const subjectBounds = await detectIllustrationSubjectBounds(temporaryChromaOutputPath);
    const normalizedCrop = resolveIllustrationSubjectCrop(chromaDimensions, subjectBounds);
    await runChildCommand({
      executable: "ffmpeg",
      arguments: [
        "-hide_banner",
        "-loglevel", "error",
        "-y",
        "-i", temporaryChromaOutputPath,
        "-vf", `crop=${normalizedCrop.width}:${normalizedCrop.height}:${normalizedCrop.x}:${normalizedCrop.y},format=rgba`,
        "-frames:v", "1",
        temporaryNormalizedOutputPath
      ]
    });
    const normalizedDimensions = await readImageDimensions(temporaryNormalizedOutputPath);
    if (
      normalizedDimensions.width !== normalizedCrop.width ||
      normalizedDimensions.height !== normalizedCrop.height ||
      !normalizedDimensions.pixelFormat.includes("a")
    ) {
      throw new Error(
        `Normalized illustration ${outputPath} must be ${normalizedCrop.width}x${normalizedCrop.height} with alpha, received ` +
        `${normalizedDimensions.width}x${normalizedDimensions.height} ${normalizedDimensions.pixelFormat}.`
      );
    }
    assertKnowledgeExplainerIllustrationAspectRatio(normalizedDimensions);
    await rename(temporaryNormalizedOutputPath, outputPath);
  } finally {
    await rm(temporaryChromaOutputPath, { force: true });
    await rm(temporaryNormalizedOutputPath, { force: true });
  }
}

async function ingestIllustrationSheet(request: IllustrationSheetIngestionRequest): Promise<void> {
  const sourcePath = resolve(request.sourcePath);
  const manifest = parseManifest(await loadYaml(resolve(request.manifestPath)));
  const catalogPath = resolve(request.catalogPath);
  const catalog = parseIllustrationCatalog(await loadYaml(catalogPath));
  const dimensions = await readImageDimensions(sourcePath);
  const plan = buildIllustrationSheetIngestionPlan(manifest, dimensions);
  const catalogEntries = buildCatalogEntries(manifest, plan.sourceAssetPath, plan.cells);
  if (request.refreshExistingBatch) {
    assertCatalogCanRefreshBatch(catalog, catalogEntries);
  } else {
    assertCatalogCanRegister(catalog, catalogEntries);
  }

  const assetRootDirectory = resolve(request.assetRootDirectory);
  const sourceDestinationPath = join(assetRootDirectory, plan.sourceAssetPath);
  const outputPaths = plan.cells.map((cell) => join(assetRootDirectory, cell.assetPath));
  if (!request.refreshExistingBatch) {
    await assertFileDoesNotExist(sourceDestinationPath);
    for (const outputPath of outputPaths) {
      await assertFileDoesNotExist(outputPath);
    }
  }
  if (request.dryRun) {
    console.log(JSON.stringify({
      status: "dry-run",
      mode: request.refreshExistingBatch ? "refresh-existing-batch" : "register-new-batch",
      sourcePath,
      sourceAssetPath: plan.sourceAssetPath,
      cells: plan.cells.map((cell) => ({ assetId: cell.assetId, assetPath: cell.assetPath, crop: cell.crop })),
      catalogPath
    }, null, 2));
    return;
  }

  // 先将可追溯的原始母版和每个独立切片写入项目资源目录；全部成功后才更新活清单。
  await mkdir(dirname(sourceDestinationPath), { recursive: true });
  await copyFile(sourcePath, sourceDestinationPath);
  for (const [index, cell] of plan.cells.entries()) {
    const outputPath = outputPaths[index];
    if (!outputPath) {
      throw new Error(`Missing planned output path for illustration asset ${cell.assetId}.`);
    }
    await mkdir(dirname(outputPath), { recursive: true });
    await renderIllustrationCell(sourcePath, outputPath, cell.crop);
  }

  const updatedCatalog: IllustrationCatalog = {
    ...catalog,
    entries: [...catalog.entries, ...catalogEntries]
  };
  if (!request.refreshExistingBatch) {
    await writeFile(catalogPath, stringifyYaml(updatedCatalog));
  }
  console.log(JSON.stringify({
    status: request.refreshExistingBatch ? "refreshed" : "pass",
    batchId: manifest.batchId,
    sourceAssetPath: plan.sourceAssetPath,
    registeredAssetIds: catalogEntries.map((entry) => entry.id),
    resourceDirectory: relative(process.cwd(), assetRootDirectory),
    catalogPath
  }, null, 2));
}

  ingestIllustrationSheet(parseIllustrationSheetIngestionRequest(process.argv.slice(2))).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[knowledge-explainer] ${message}`);
  process.exitCode = 1;
});
