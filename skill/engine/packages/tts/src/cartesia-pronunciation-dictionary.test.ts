import { describe, expect, it } from "vitest";
import { CartesiaPronunciationCatalogSchema } from "@knowledge-explainer/contracts";
import { CartesiaPronunciationDictionaryGateway, type CartesiaPronunciationDictionaryGatewayConfig } from "./cartesia-pronunciation-dictionary";
import type { FetchTransport } from "./tts-gateway";

const gatewayConfig: CartesiaPronunciationDictionaryGatewayConfig = {
  apiKey: "test-key",
  apiVersion: "2026-03-01",
  endpoint: "https://example.test/pronunciation-dicts"
};

describe("CartesiaPronunciationDictionaryGateway", () => {
  it("首次同步时创建远程词典，并跳过仅用于 spell 的条目", async () => {
    let request: RequestInit | undefined;
    const fetchTransport: FetchTransport = async (_input, init) => {
      request = init;
      return Response.json({ id: "pdict-new" });
    };
    const catalog = CartesiaPronunciationCatalogSchema.parse({
      kind: "cartesia-pronunciation-catalog",
      dictionary: { name: "Knowledge Explainer", description: "生产纠正" },
      entries: [
        { id: "term", text: "微博", language: "zh", notation: "sounds-like", pronunciation: "wei bo", applicationScenarios: ["平台名"] },
        { id: "initialism", text: "GPT", language: "en", notation: "spell", applicationScenarios: ["缩写"] }
      ]
    });

    const result = await new CartesiaPronunciationDictionaryGateway(gatewayConfig, fetchTransport).synchronizeCatalog(catalog);

    expect(request?.method).toBe("POST");
    expect(JSON.parse(String(request?.body))).toEqual({
      name: "Knowledge Explainer",
      description: "生产纠正",
      items: [{ text: "微博", alias: "wei bo" }]
    });
    expect(result).toEqual({ remoteId: "pdict-new", entryIds: ["term"] });
  });

  it("已有远程 ID 时用 PATCH 覆盖活清单", async () => {
    let request: RequestInit | undefined;
    const fetchTransport: FetchTransport = async (_input, init) => {
      request = init;
      return Response.json({ id: "pdict-existing" });
    };
    const catalog = CartesiaPronunciationCatalogSchema.parse({
      kind: "cartesia-pronunciation-catalog",
      dictionary: { name: "Knowledge Explainer", description: "生产纠正", remoteId: "pdict-existing" },
      entries: []
    });

    const result = await new CartesiaPronunciationDictionaryGateway(gatewayConfig, fetchTransport).synchronizeCatalog(catalog);

    expect(request?.method).toBe("PATCH");
    expect(JSON.parse(String(request?.body))).toEqual({ name: "Knowledge Explainer", items: [] });
    expect(result).toEqual({ remoteId: "pdict-existing", entryIds: [] });
  });
});
