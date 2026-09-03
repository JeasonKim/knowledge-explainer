import { homedir } from "node:os";
import { resolve } from "node:path";

export const workspaceRoot = resolve(process.env.KNOWLEDGE_EXPLAINER_WORKSPACE ?? `${homedir()}/.knowledge-explainer`);
export const engineRoot = resolve(process.env.KNOWLEDGE_EXPLAINER_ENGINE_ROOT ?? process.cwd());
export const workspaceAssetsRoot = resolve(workspaceRoot, "assets");

export function resolveEnginePath(...pathSegments: string[]): string {
  return resolve(engineRoot, ...pathSegments);
}
