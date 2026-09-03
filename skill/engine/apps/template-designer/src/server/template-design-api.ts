import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  CreationMethodIdSchema,
  VideoTemplateDesignSchema,
  type CreationMethodId,
  type VideoTemplateDesign
} from "@knowledge-explainer/contracts";
import { resolveTemplateDesignFile } from "./template-design-path";
import { assertTemplateDebuggingDraftKeepsContract } from "./template-debugging-boundary";

type TemplateDesignerApiOptions = {
  engineRoot: string;
  workspaceRoot: string;
};

type TemplateDesignSummary = {
  creationMethodId: CreationMethodId;
  templateId: string;
  displayName: string;
  views: Array<{ id: string; displayName: string }>;
};

type TemplateDebuggingDraftRequest = {
  creationMethodId: string;
  templateId: string;
  design: unknown;
};

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function parseTemplateDesignJson(contents: string, source: string): VideoTemplateDesign {
  try {
    return VideoTemplateDesignSchema.parse(JSON.parse(contents) as unknown);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot load template design ${source}: ${message}`);
  }
}

async function readTemplateDesign(
  options: TemplateDesignerApiOptions,
  creationMethodId: string,
  templateId: string
): Promise<VideoTemplateDesign> {
  const file = resolveTemplateDesignFile({
    engineRoot: options.engineRoot,
    creationMethodId,
    templateId
  });
  const design = parseTemplateDesignJson(await readFile(file.absolutePath, "utf8"), file.relativePath);
  if (design.creationMethodId !== creationMethodId || design.id !== templateId) {
    throw new Error(`Template identity does not match ${file.relativePath}.`);
  }
  return design;
}

async function listTemplateDesigns(options: TemplateDesignerApiOptions): Promise<TemplateDesignSummary[]> {
  const templatesRoot = resolve(options.engineRoot, "packages/template-design/src/templates");
  const summaries: TemplateDesignSummary[] = [];
  for (const creationMethodId of [CreationMethodIdSchema.value]) {
    const methodDirectory = resolve(templatesRoot, creationMethodId);
    const entries = await readdir(methodDirectory, { withFileTypes: true });
    for (const entry of entries.filter((candidate) => candidate.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
      const design = await readTemplateDesign(options, creationMethodId, entry.name);
      summaries.push({
        creationMethodId: design.creationMethodId,
        templateId: design.id,
        displayName: design.displayName,
        views: design.views.map((view) => ({ id: view.id, displayName: view.displayName }))
      });
    }
  }
  return summaries;
}

function readRequestBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, rejectBody) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > 2_000_000) {
        rejectBody(new Error("Template design request is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(body) as unknown);
      } catch {
        rejectBody(new Error("Template design request must be valid JSON."));
      }
    });
    request.on("error", rejectBody);
  });
}

function parseTemplateDebuggingDraftRequest(value: unknown): TemplateDebuggingDraftRequest {
  if (!value || typeof value !== "object") {
    throw new Error("Template design request must be an object.");
  }
  const request = value as Record<string, unknown>;
  if (typeof request.creationMethodId !== "string" || typeof request.templateId !== "string") {
    throw new Error("Template design request requires creationMethodId and templateId.");
  }
  return {
    creationMethodId: request.creationMethodId,
    templateId: request.templateId,
    design: request.design
  };
}

async function persistTemplateDebuggingDraft(
  options: TemplateDesignerApiOptions,
  value: unknown
): Promise<VideoTemplateDesign> {
  const request = parseTemplateDebuggingDraftRequest(value);
  const file = resolveTemplateDesignFile({
    engineRoot: options.engineRoot,
    creationMethodId: request.creationMethodId,
    templateId: request.templateId
  });
  const design = VideoTemplateDesignSchema.parse(request.design);
  if (design.creationMethodId !== request.creationMethodId || design.id !== request.templateId) {
    throw new Error("Template identity cannot change during save.");
  }
  const persisted = await readTemplateDesign(options, request.creationMethodId, request.templateId);
  assertTemplateDebuggingDraftKeepsContract(persisted, design);
  await writeFile(file.absolutePath, `${JSON.stringify(design, null, 2)}\n`, "utf8");
  return design;
}

function respondWithApiError(response: ServerResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  sendJson(response, 400, { message });
}

/**
 * 浏览器只调试固定模板契约中的文字样例与视觉参数；保存后引擎读取同一份 JSON。
 */
export function createTemplateDesignerApi(options: TemplateDesignerApiOptions): Plugin {
  return {
    name: "knowledge-explainer-template-designer-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        try {
          if (request.method === "GET" && url.pathname === "/api/template-designs") {
            sendJson(response, 200, { templates: await listTemplateDesigns(options) });
            return;
          }
          if (request.method === "GET" && url.pathname === "/api/template-design") {
            const creationMethodId = url.searchParams.get("creationMethodId") ?? "";
            const templateId = url.searchParams.get("templateId") ?? "";
            sendJson(response, 200, { design: await readTemplateDesign(options, creationMethodId, templateId) });
            return;
          }
          if (request.method === "PUT" && url.pathname === "/api/template-design") {
            sendJson(response, 200, { design: await persistTemplateDebuggingDraft(options, await readRequestBody(request)) });
            return;
          }
        } catch (error) {
          respondWithApiError(response, error);
          return;
        }
        next();
      });
    }
  };
}
