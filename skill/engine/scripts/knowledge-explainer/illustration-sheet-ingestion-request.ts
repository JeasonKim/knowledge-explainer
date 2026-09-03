export type IllustrationSheetIngestionRequest = {
  sourcePath: string;
  manifestPath: string;
  catalogPath: string;
  assetRootDirectory: string;
  dryRun: boolean;
  refreshExistingBatch: boolean;
};

function readFlag(argumentsList: string[], flag: string): string | undefined {
  const flagIndex = argumentsList.indexOf(flag);
  return flagIndex >= 0 ? argumentsList[flagIndex + 1] : undefined;
}

function requireFlag(argumentsList: string[], flag: string, label: string): string {
  const value = readFlag(argumentsList, flag);
  if (!value) {
    throw new Error(`Expected ${flag} <${label}>.`);
  }
  return value;
}

export function parseIllustrationSheetIngestionRequest(argumentsList: string[]): IllustrationSheetIngestionRequest {
  return {
    sourcePath: requireFlag(argumentsList, "--source", "generated-sheet.png"),
    manifestPath: requireFlag(argumentsList, "--manifest", "illustration-sheet-manifest.yaml"),
    catalogPath: requireFlag(argumentsList, "--catalog", "illustration-catalog.yaml"),
    assetRootDirectory: requireFlag(argumentsList, "--asset-root", "asset-root"),
    dryRun: argumentsList.includes("--dry-run"),
    refreshExistingBatch: argumentsList.includes("--refresh-existing-batch")
  };
}
