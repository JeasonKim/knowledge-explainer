import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toJSONSchema } from "zod";
import { KnowledgeExplainerCreationPlanSchema } from "../packages/contracts/src/index";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(SCRIPT_DIRECTORY, "../../references/creation-plan.schema.json");

function publishKnowledgeExplainerContract(): void {
  const schema = toJSONSchema(KnowledgeExplainerCreationPlanSchema, { target: "draft-2020-12" });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "knowledge-explainer/creation-plan",
    title: "knowledge-explainer creation plan",
    ...schema
  }, null, 2)}\n`);
}

publishKnowledgeExplainerContract();
