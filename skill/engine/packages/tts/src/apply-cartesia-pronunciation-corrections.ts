import type {
  CartesiaPronunciationCatalog,
  CartesiaPronunciationEntry,
  TtsVoiceLanguage
} from "@knowledge-explainer/contracts";

export type CartesiaDictionaryEntry = {
  text: string;
  alias: string;
  entryId: string;
};

export type CartesiaSpellCorrectionResult = {
  transcript: string;
  appliedEntryIds: string[];
};

function isActiveForLanguage(
  entry: CartesiaPronunciationEntry,
  language: TtsVoiceLanguage | undefined
): boolean {
  return entry.status === "active" && (!language || entry.language === language);
}

function startsWithCorrection(
  source: string,
  index: number,
  entry: CartesiaPronunciationEntry
): boolean {
  const candidate = source.slice(index, index + entry.text.length);
  if (entry.matchMode === "case-insensitive") {
    return candidate.toLocaleLowerCase("en-US") === entry.text.toLocaleLowerCase("en-US");
  }
  return candidate === entry.text;
}

export function selectCartesiaDictionaryEntries(
  catalog: CartesiaPronunciationCatalog,
  language?: TtsVoiceLanguage
): CartesiaDictionaryEntry[] {
  return catalog.entries
    .filter((entry) => isActiveForLanguage(entry, language) && entry.notation !== "spell")
    .map((entry) => ({
      text: entry.text,
      alias: entry.pronunciation!,
      entryId: entry.id
    }));
}

export function applyCartesiaSpellCorrections(
  transcript: string,
  catalog: CartesiaPronunciationCatalog | undefined,
  language: TtsVoiceLanguage
): CartesiaSpellCorrectionResult {
  if (!catalog) {
    return { transcript, appliedEntryIds: [] };
  }
  const entries = catalog.entries
    .filter((entry) => isActiveForLanguage(entry, language) && entry.notation === "spell")
    .sort((left, right) => right.text.length - left.text.length);
  if (entries.length === 0) {
    return { transcript, appliedEntryIds: [] };
  }

  let cursor = 0;
  let compiled = "";
  const appliedEntryIds = new Set<string>();
  while (cursor < transcript.length) {
    const correction = entries.find((entry) => startsWithCorrection(transcript, cursor, entry));
    if (!correction) {
      compiled += transcript[cursor];
      cursor += 1;
      continue;
    }
    const originalText = transcript.slice(cursor, cursor + correction.text.length);
    compiled += `<spell>${originalText}</spell>`;
    appliedEntryIds.add(correction.id);
    cursor += correction.text.length;
  }
  return { transcript: compiled, appliedEntryIds: [...appliedEntryIds] };
}
