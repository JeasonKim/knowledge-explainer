import { describe, expect, it } from "vitest";
import { shouldApplyProjectQualityGate } from "./resolve-project-quality-gate";

describe("project quality gate", () => {
  it("正式渲染默认跳过质量验证", () => {
    expect(shouldApplyProjectQualityGate("render")).toBe(true);
  });

  it("显式验收命令仍执行质量验证", () => {
    expect(shouldApplyProjectQualityGate("validate")).toBe(true);
    expect(shouldApplyProjectQualityGate("inspect")).toBe(true);
    expect(shouldApplyProjectQualityGate("verify")).toBe(true);
  });
});
