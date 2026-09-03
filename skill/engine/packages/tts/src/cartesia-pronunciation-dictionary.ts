import type { CartesiaPronunciationCatalog } from "@knowledge-explainer/contracts";
import type { FetchTransport } from "./tts-gateway";
import { selectCartesiaDictionaryEntries } from "./apply-cartesia-pronunciation-corrections";

export type CartesiaPronunciationDictionaryGatewayConfig = {
  apiKey: string;
  apiVersion: string;
  endpoint?: string;
};

export type CartesiaPronunciationDictionarySyncResult = {
  remoteId?: string;
  entryIds: string[];
};

type CartesiaDictionaryResponse = {
  id?: unknown;
};

const defaultEndpoint = "https://api.cartesia.ai/pronunciation-dicts";

function resolveDictionaryErrorMessage(response: Response, responseText: string): string {
  const compactBody = responseText.replace(/\s+/g, " ").trim().slice(0, 300);
  const details = compactBody ? ` body=${compactBody}` : "";
  return `Cartesia pronunciation dictionary request failed status=${response.status}.${details}`;
}

function parseDictionaryId(payload: CartesiaDictionaryResponse): string {
  if (typeof payload.id !== "string" || payload.id.length === 0) {
    throw new Error("Cartesia pronunciation dictionary response does not include an id.");
  }
  return payload.id;
}

export class CartesiaPronunciationDictionaryGateway {
  private readonly endpoint: string;

  public constructor(
    private readonly config: CartesiaPronunciationDictionaryGatewayConfig,
    private readonly fetchTransport: FetchTransport = fetch
  ) {
    this.endpoint = config.endpoint ?? defaultEndpoint;
  }

  public async synchronizeCatalog(
    catalog: CartesiaPronunciationCatalog
  ): Promise<CartesiaPronunciationDictionarySyncResult> {
    const entries = selectCartesiaDictionaryEntries(catalog);
    if (entries.length === 0 && !catalog.dictionary.remoteId) {
      return { entryIds: [] };
    }

    const remoteId = catalog.dictionary.remoteId;
    const response = await this.fetchTransport(
      remoteId ? `${this.endpoint}/${encodeURIComponent(remoteId)}` : `${this.endpoint}/`,
      {
        method: remoteId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Cartesia-Version": this.config.apiVersion,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(remoteId
          ? { name: catalog.dictionary.name, items: entries.map(({ text, alias }) => ({ text, alias })) }
          : {
              name: catalog.dictionary.name,
              description: catalog.dictionary.description,
              items: entries.map(({ text, alias }) => ({ text, alias }))
            })
      }
    );
    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(resolveDictionaryErrorMessage(response, responseText));
    }
    const payload = await response.json() as CartesiaDictionaryResponse;
    return {
      remoteId: parseDictionaryId(payload),
      entryIds: entries.map((entry) => entry.entryId)
    };
  }
}
