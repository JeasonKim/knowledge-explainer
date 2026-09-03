import { relative, resolve } from "node:path";
import { CreationMethodIdSchema, type CreationMethodId } from "@knowledge-explainer/contracts";

export type ResolveTemplateDesignFileRequest = {
  engineRoot: string;
  creationMethodId: string;
  templateId: string;
};

export type TemplateDesignFile = {
  absolutePath: string;
  relativePath: string;
};

function parseCreationMethodId(value: string): CreationMethodId {
  const result = CreationMethodIdSchema.safeParse(value);
  if (!result.success) {
    throw new Error("Template creation method is invalid.");
  }
  return result.data;
}

function parseTemplateId(value: string): string {
  const templateId = value.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(templateId)) {
    throw new Error("Template id is invalid.");
  }
  return templateId;
}

/**
 * 模板效果调试器只允许读写 Skill 引擎内的正式模板契约，浏览器参数不能扩展成任意文件路径。
 */
export function resolveTemplateDesignFile(
  request: ResolveTemplateDesignFileRequest
): TemplateDesignFile {
  const creationMethodId = parseCreationMethodId(request.creationMethodId);
  const templateId = parseTemplateId(request.templateId);
  const templatesRoot = resolve(request.engineRoot, "packages/template-design/src/templates");
  const absolutePath = resolve(templatesRoot, creationMethodId, templateId, "template.json");
  const relativePath = relative(templatesRoot, absolutePath).replaceAll("\\", "/");
  if (relativePath === "" || relativePath === ".." || relativePath.startsWith("../")) {
    throw new Error("Template design file must stay inside engine templates.");
  }
  return { absolutePath, relativePath };
}
