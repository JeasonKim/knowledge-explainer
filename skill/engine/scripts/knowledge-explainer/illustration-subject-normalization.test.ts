import { describe, expect, it } from "vitest";
import {
  assertKnowledgeExplainerIllustrationAspectRatio,
  resolveIllustrationSubjectCrop,
  type IllustrationCanvas,
  type IllustrationSubjectBounds
} from "./illustration-subject-normalization";

describe("knowledge explainer illustration subject normalization", () => {
  const canvas: IllustrationCanvas = { width: 512, height: 512 };

  it("裁掉透明留白并为主体保留稳定安全边距", () => {
    const subject: IllustrationSubjectBounds = {
      x: 139,
      y: 62,
      width: 262,
      height: 385
    };

    expect(resolveIllustrationSubjectCrop(canvas, subject)).toEqual({
      x: 123,
      y: 38,
      width: 294,
      height: 433,
      subjectLongEdgeRatio: 385 / 433
    });
  });

  it("主体靠近母版边缘时限制裁切范围且保持足够占比", () => {
    const subject: IllustrationSubjectBounds = {
      x: 2,
      y: 10,
      width: 480,
      height: 400
    };

    const crop = resolveIllustrationSubjectCrop(canvas, subject);

    expect(crop).toEqual({
      x: 0,
      y: 0,
      width: 511,
      height: 434,
      subjectLongEdgeRatio: 480 / 511
    });
    expect(crop.subjectLongEdgeRatio).toBeGreaterThanOrEqual(0.82);
  });

  it("拒绝越过画布的错误主体边界", () => {
    const subject: IllustrationSubjectBounds = {
      x: 400,
      y: 20,
      width: 120,
      height: 100
    };

    expect(() => resolveIllustrationSubjectCrop(canvas, subject))
      .toThrow("must stay inside");
  });

  it.each([
    { width: 300, height: 500 },
    { width: 512, height: 512 },
    { width: 800, height: 500 }
  ])("接受模板能够稳定放大的资源比例 $width×$height", (dimensions) => {
    expect(() => assertKnowledgeExplainerIllustrationAspectRatio(dimensions)).not.toThrow();
  });

  it.each([
    { width: 299, height: 500 },
    { width: 801, height: 500 }
  ])("拒绝会在模板中显得过小的资源比例 $width×$height", (dimensions) => {
    expect(() => assertKnowledgeExplainerIllustrationAspectRatio(dimensions))
      .toThrow("aspect ratio");
  });
});
