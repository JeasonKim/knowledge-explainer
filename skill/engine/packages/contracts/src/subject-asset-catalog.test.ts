import { describe, expect, it } from "vitest";
import { SubjectAssetCatalogSchema } from "./index";

describe("SubjectAssetCatalogSchema", () => {
  it("接受知识讲解主体的基准图与方法衍生图", () => {
    const catalog = SubjectAssetCatalogSchema.parse({
      kind: "knowledge-explainer-subject-catalog",
      subjects: [{
        id: "sample-learner", displayName: "示例学习者", identityDescription: "保持中性人物轮廓一致。",
        canonicalAssetPath: "shared/subjects/sample-learner/canonical.png",
        allowedCreationMethods: ["knowledge-explainer"],
        derivatives: [{ creationMethodId: "knowledge-explainer", assetPath: "method/subjects/sample-learner.png" }]
      }]
    });
    expect(catalog.subjects[0]?.derivatives[0]?.creationMethodId).toBe("knowledge-explainer");
  });

  it("拒绝方法目录之外的衍生图", () => {
    const result = SubjectAssetCatalogSchema.safeParse({
      kind: "knowledge-explainer-subject-catalog",
      subjects: [{
        id: "sample-learner", displayName: "示例学习者", identityDescription: "保持中性人物轮廓一致。",
        canonicalAssetPath: "shared/subjects/sample-learner/canonical.png",
        allowedCreationMethods: ["knowledge-explainer"],
        derivatives: [{ creationMethodId: "knowledge-explainer", assetPath: "shared/sample-learner.png" }]
      }]
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain("must stay in its creation method asset directory");
  });
});
