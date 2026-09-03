import { describe, expect, it } from "vitest";
import { resolvePublicProductionAsset } from "./resolve-public-production-asset";

describe("resolvePublicProductionAsset", () => {
  it("将相对工作区 assets 的资源 ID 同时解析为文件路径与渲染路径", () => {
    expect(resolvePublicProductionAsset({
      requestedPath: "audio/narration.wav",
      publicDirectory: "/tmp/knowledge-explainer/assets",
      assetLabel: "narration audio"
    })).toEqual({
      absolutePath: "/tmp/knowledge-explainer/assets/audio/narration.wav",
      publicPath: "audio/narration.wav"
    });
  });

  it("拒绝把 assets 目录名前缀写进渲染资源 ID", () => {
    expect(() => resolvePublicProductionAsset({
      requestedPath: "assets/audio/narration.wav",
      publicDirectory: "/tmp/knowledge-explainer/assets",
      assetLabel: "narration audio"
    })).toThrow("must be relative to workspace assets/");
  });

  it("拒绝越出 public 目录的资源路径", () => {
    expect(() => resolvePublicProductionAsset({
      requestedPath: "../private/narration.wav",
      publicDirectory: "/tmp/knowledge-explainer/assets",
      assetLabel: "narration audio"
    })).toThrow("must not escape workspace assets/");
  });
});
