import { isAbsolute, relative, resolve } from "node:path";

export type PublicProductionAssetRequest = {
  requestedPath: string;
  publicDirectory: string;
  assetLabel: string;
};

export type PublicProductionAsset = {
  absolutePath: string;
  publicPath: string;
};

export function resolvePublicProductionAsset(
  request: PublicProductionAssetRequest
): PublicProductionAsset {
  const requestedPath = request.requestedPath.replace(/\\/g, "/").trim();
  if (!requestedPath) {
    throw new Error(`${request.assetLabel} path must be relative to workspace assets/.`);
  }
  if (isAbsolute(requestedPath) || requestedPath === "assets" || requestedPath.startsWith("assets/")) {
    throw new Error(`${request.assetLabel} path must be relative to workspace assets/ without an assets/ prefix.`);
  }

  const absolutePath = resolve(request.publicDirectory, requestedPath);
  const publicPath = relative(request.publicDirectory, absolutePath).replace(/\\/g, "/");
  if (!publicPath || publicPath === ".." || publicPath.startsWith("../")) {
    throw new Error(`${request.assetLabel} path must not escape workspace assets/.`);
  }
  return { absolutePath, publicPath };
}
