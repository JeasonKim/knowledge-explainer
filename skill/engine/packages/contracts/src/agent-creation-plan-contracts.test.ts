import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { toJSONSchema } from "zod";
import { KnowledgeExplainerCreationPlanSchema } from "./index";

const ENGINE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Agent 创作计划契约", () => {
  it("把运行时 schema 原样发布到 Skill reference 包", () => {
    const publishedPath = resolve(ENGINE_ROOT, "..", "references", "creation-plan.schema.json");
    const publishedContract = JSON.parse(readFileSync(publishedPath, "utf8")) as object;

    expect(publishedContract).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "knowledge-explainer/creation-plan",
      title: "knowledge-explainer creation plan",
      ...toJSONSchema(KnowledgeExplainerCreationPlanSchema, { target: "draft-2020-12" })
    });
  });
});
