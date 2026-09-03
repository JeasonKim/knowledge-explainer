import {
  findNarrationSpeechDensityIssues,
  NarrationTimingMapSchema,
  type NarrationTimingMap
} from "@knowledge-explainer/contracts";

export type LocalAlignmentNarrationCard = {
  id: string;
  narrationText: string;
};

export type LocalAlignmentTimedToken = {
  text: string;
  startMs: number;
  endMs: number;
};

export type LocalForcedAlignmentTimingMapRequest = {
  durationMs: number;
  cards: LocalAlignmentNarrationCard[];
  tokens: LocalAlignmentTimedToken[];
  minimumExactMatchRatio: number;
};

export type LocalForcedAlignmentQuality = {
  sourceCharacterCount: number;
  recognizedCharacterCount: number;
  exactMatchCharacterCount: number;
  interpolatedCharacterCount: number;
  rebalancedCharacterCount: number;
  rebalancedSegmentIds: string[];
  clampedTerminalTokenCount: number;
  editDistance: number;
  exactMatchRatio: number;
};

export type LocalForcedAlignmentTimingMapResult = {
  timingMap: NarrationTimingMap;
  quality: LocalForcedAlignmentQuality;
};

type SourceNarrationCharacter = {
  cardIndex: number;
  character: string;
};

type RecognizedNarrationCharacter = {
  character: string;
  startMs: number;
  endMs: number;
};

type AlignedNarrationCharacter = SourceNarrationCharacter & {
  startMs: number;
  endMs: number;
};

type AlignmentTrace = {
  alignedCharacters: Array<AlignedNarrationCharacter | undefined>;
  exactMatchCharacterCount: number;
  editDistance: number;
};

type ExpandedRecognizedNarration = {
  characters: RecognizedNarrationCharacter[];
  clampedTerminalTokenCount: number;
};

type RebalancedNarrationAlignment = {
  characters: AlignedNarrationCharacter[];
  rebalancedCharacterCount: number;
  rebalancedSegmentIds: string[];
};

const traditionalToSimplifiedPairs = [
  ["這", "这"], ["會", "会"], ["無", "无"], ["數", "数"], ["個", "个"], ["問", "问"], ["題", "题"],
  ["後", "后"], ["實", "实"], ["決", "决"], ["戀", "恋"], ["覺", "觉"], ["業", "业"], ["產", "产"],
  ["錢", "钱"], ["萬", "万"], ["別", "别"], ["種", "种"], ["層", "层"], ["發", "发"], ["現", "现"],
  ["們", "们"], ["為", "为"], ["東", "东"], ["變", "变"], ["遠", "远"], ["愛", "爱"], ["繼", "继"],
  ["續", "续"], ["體", "体"], ["聽", "听"], ["話", "话"], ["擁", "拥"], ["恆", "恒"], ["暫", "暂"],
  ["時", "时"], ["換", "换"], ["說", "说"], ["類", "类"], ["質", "质"], ["來", "来"], ["場", "场"],
  ["衝", "冲"], ["對", "对"], ["長", "长"], ["執", "执"], ["著", "着"], ["認", "认"], ["點", "点"],
  ["輩", "辈"], ["從", "从"], ["關", "关"], ["係", "系"]
] as const;

const traditionalToSimplified = new Map<string, string>(traditionalToSimplifiedPairs);
const spokenCharacterPattern = /[\p{L}\p{N}]/u;
const arabicIntegerPattern = /^\d+$/u;
const maximumTerminalAsrOverrunMs = 500;
const maximumAdjacentNumericTokenGapMs = 80;

const chineseDigitCharacters = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;
const chinesePlaceUnits = ["", "十", "百", "千"] as const;

function normalizeSpokenCharacters(text: string): string[] {
  return Array.from(text)
    .filter((character) => spokenCharacterPattern.test(character))
    .map((character) => traditionalToSimplified.get(character) ?? character.toLowerCase());
}

function pronounceArabicInteger(integerText: string): string {
  const normalizedInteger = integerText.replace(/^0+(?=\d)/u, "");
  if (normalizedInteger.length > 4) {
    return Array.from(normalizedInteger)
      .map((digit) => chineseDigitCharacters[Number(digit)]!)
      .join("");
  }
  const digits = Array.from(normalizedInteger, Number);
  let pronunciation = "";
  let pendingZero = false;
  for (const [index, digit] of digits.entries()) {
    const place = digits.length - index - 1;
    if (digit === 0) {
      if (pronunciation && digits.slice(index + 1).some((remainingDigit) => remainingDigit !== 0)) {
        pendingZero = true;
      }
      continue;
    }
    if (pendingZero) {
      pronunciation += "零";
      pendingZero = false;
    }
    const omitLeadingOne = digit === 1 && place === 1 && pronunciation.length === 0;
    if (!omitLeadingOne) {
      pronunciation += chineseDigitCharacters[digit];
    }
    pronunciation += chinesePlaceUnits[place];
  }
  return pronunciation || "零";
}

function coalesceAdjacentArabicNumberTokens(
  tokens: LocalAlignmentTimedToken[]
): LocalAlignmentTimedToken[] {
  const coalescedTokens: LocalAlignmentTimedToken[] = [];
  for (const token of tokens) {
    const normalizedText = token.text.normalize("NFKC").trim();
    const previousToken = coalescedTokens.at(-1);
    const canJoinPrevious = previousToken
      && arabicIntegerPattern.test(previousToken.text)
      && arabicIntegerPattern.test(normalizedText)
      && token.startMs >= previousToken.endMs
      && token.startMs - previousToken.endMs <= maximumAdjacentNumericTokenGapMs;
    if (canJoinPrevious) {
      previousToken.text += normalizedText;
      previousToken.endMs = token.endMs;
      continue;
    }
    coalescedTokens.push({ ...token, text: normalizedText });
  }
  return coalescedTokens;
}

function normalizeRecognizedCharacters(text: string): string[] {
  return arabicIntegerPattern.test(text)
    ? Array.from(pronounceArabicInteger(text))
    : normalizeSpokenCharacters(text);
}

function assertPositiveDuration(durationMs: number): void {
  if (!Number.isInteger(durationMs) || durationMs <= 0) {
    throw new Error("Local forced alignment durationMs must be a positive integer.");
  }
}

function assertMinimumExactMatchRatio(minimumExactMatchRatio: number): void {
  if (!Number.isFinite(minimumExactMatchRatio) || minimumExactMatchRatio <= 0 || minimumExactMatchRatio > 1) {
    throw new Error("Local forced alignment minimumExactMatchRatio must be within (0, 1].");
  }
}

function expandSourceNarrationCharacters(cards: LocalAlignmentNarrationCard[]): SourceNarrationCharacter[] {
  if (cards.length === 0) {
    throw new Error("Local forced alignment requires at least one narration card.");
  }

  const knownCardIds = new Set<string>();
  const characters: SourceNarrationCharacter[] = [];
  cards.forEach((card, cardIndex) => {
    if (knownCardIds.has(card.id)) {
      throw new Error(`Local forced alignment received duplicate narration card id ${card.id}.`);
    }
    knownCardIds.add(card.id);
    const normalizedText = normalizeSpokenCharacters(card.narrationText);
    if (normalizedText.length === 0) {
      throw new Error(`Local forced alignment card ${card.id} has no spoken characters.`);
    }
    normalizedText.forEach((character) => characters.push({ cardIndex, character }));
  });
  return characters;
}

function expandRecognizedNarrationCharacters(
  tokens: LocalAlignmentTimedToken[],
  durationMs: number
): ExpandedRecognizedNarration {
  const characters: RecognizedNarrationCharacter[] = [];
  let clampedTerminalTokenCount = 0;
  const recognizedTokens = coalesceAdjacentArabicNumberTokens(tokens);
  const terminalOverrunStartIndex = recognizedTokens.findIndex((token) => token.endMs > durationMs);
  for (const [tokenIndex, token] of recognizedTokens.entries()) {
    if (
      !Number.isFinite(token.startMs) ||
      !Number.isFinite(token.endMs) ||
      token.startMs < 0 ||
      token.endMs < token.startMs
    ) {
      throw new Error(`Local forced alignment received an invalid ASR token range for ${token.text}.`);
    }
    const belongsToTerminalOverrun = terminalOverrunStartIndex >= 0 && tokenIndex >= terminalOverrunStartIndex;
    const terminalEndOverrunMs = token.endMs - durationMs;
    const terminalStartOverrunMs = token.startMs - durationMs;
    if (token.startMs >= durationMs && !belongsToTerminalOverrun) {
      throw new Error(`Local forced alignment received an invalid ASR token range for ${token.text}.`);
    }
    if (
      belongsToTerminalOverrun &&
      (terminalStartOverrunMs > maximumTerminalAsrOverrunMs || terminalEndOverrunMs > maximumTerminalAsrOverrunMs)
    ) {
      throw new Error(`Local forced alignment received an invalid ASR token range for ${token.text}.`);
    }
    const boundedStartMs = Math.min(token.startMs, durationMs);
    const boundedEndMs = Math.min(token.endMs, durationMs);
    if (token.startMs >= durationMs || token.endMs > durationMs) {
      clampedTerminalTokenCount += 1;
    }
    const normalizedText = normalizeRecognizedCharacters(token.text);
    normalizedText.forEach((character, characterIndex) => {
      const intervalMs = boundedEndMs - boundedStartMs;
      const startMs = boundedStartMs + (intervalMs * characterIndex) / normalizedText.length;
      const endMs = boundedStartMs + (intervalMs * (characterIndex + 1)) / normalizedText.length;
      characters.push({ character, startMs, endMs });
    });
  }
  if (characters.length === 0) {
    throw new Error("Local forced alignment requires at least one recognized spoken character.");
  }
  return { characters, clampedTerminalTokenCount };
}

function calculateEditDistanceMatrix(
  sourceCharacters: SourceNarrationCharacter[],
  recognizedCharacters: RecognizedNarrationCharacter[]
): number[][] {
  const matrix = Array.from(
    { length: sourceCharacters.length + 1 },
    () => new Array<number>(recognizedCharacters.length + 1).fill(0)
  );
  for (let sourceIndex = 0; sourceIndex <= sourceCharacters.length; sourceIndex += 1) {
    matrix[sourceIndex]![0] = sourceIndex;
  }
  for (let recognizedIndex = 0; recognizedIndex <= recognizedCharacters.length; recognizedIndex += 1) {
    matrix[0]![recognizedIndex] = recognizedIndex;
  }
  for (let sourceIndex = 1; sourceIndex <= sourceCharacters.length; sourceIndex += 1) {
    for (let recognizedIndex = 1; recognizedIndex <= recognizedCharacters.length; recognizedIndex += 1) {
      const sourceCharacter = sourceCharacters[sourceIndex - 1]!;
      const recognizedCharacter = recognizedCharacters[recognizedIndex - 1]!;
      const substitutionCost = sourceCharacter.character === recognizedCharacter.character ? 0 : 1;
      matrix[sourceIndex]![recognizedIndex] = Math.min(
        matrix[sourceIndex - 1]![recognizedIndex - 1]! + substitutionCost,
        matrix[sourceIndex - 1]![recognizedIndex]! + 1,
        matrix[sourceIndex]![recognizedIndex - 1]! + 1
      );
    }
  }
  return matrix;
}

function traceNarrationAlignment(
  sourceCharacters: SourceNarrationCharacter[],
  recognizedCharacters: RecognizedNarrationCharacter[],
  matrix: number[][]
): AlignmentTrace {
  const alignedCharacters: Array<AlignedNarrationCharacter | undefined> = new Array(sourceCharacters.length).fill(undefined);
  let exactMatchCharacterCount = 0;
  let sourceIndex = sourceCharacters.length;
  let recognizedIndex = recognizedCharacters.length;

  while (sourceIndex > 0 || recognizedIndex > 0) {
    const currentCost = matrix[sourceIndex]![recognizedIndex]!;
    const sourceCharacter = sourceIndex > 0 ? sourceCharacters[sourceIndex - 1] : undefined;
    const recognizedCharacter = recognizedIndex > 0 ? recognizedCharacters[recognizedIndex - 1] : undefined;
    if (
      sourceCharacter &&
      recognizedCharacter &&
      sourceCharacter.character === recognizedCharacter.character &&
      currentCost === matrix[sourceIndex - 1]![recognizedIndex - 1]!
    ) {
      alignedCharacters[sourceIndex - 1] = { ...sourceCharacter, startMs: recognizedCharacter.startMs, endMs: recognizedCharacter.endMs };
      exactMatchCharacterCount += 1;
      sourceIndex -= 1;
      recognizedIndex -= 1;
      continue;
    }
    if (sourceCharacter && currentCost === matrix[sourceIndex - 1]![recognizedIndex]! + 1) {
      sourceIndex -= 1;
      continue;
    }
    if (recognizedCharacter && currentCost === matrix[sourceIndex]![recognizedIndex - 1]! + 1) {
      recognizedIndex -= 1;
      continue;
    }
    if (sourceCharacter && recognizedCharacter && currentCost === matrix[sourceIndex - 1]![recognizedIndex - 1]! + 1) {
      alignedCharacters[sourceIndex - 1] = { ...sourceCharacter, startMs: recognizedCharacter.startMs, endMs: recognizedCharacter.endMs };
      sourceIndex -= 1;
      recognizedIndex -= 1;
      continue;
    }
    throw new Error("Local forced alignment could not trace the ASR edit-distance matrix.");
  }

  return {
    alignedCharacters,
    exactMatchCharacterCount,
    editDistance: matrix[sourceCharacters.length]![recognizedCharacters.length]!
  };
}

function interpolateMissingAlignmentCharacters(
  alignedCharacters: Array<AlignedNarrationCharacter | undefined>,
  sourceCharacters: SourceNarrationCharacter[],
  durationMs: number
): { characters: AlignedNarrationCharacter[]; interpolatedCharacterCount: number } {
  const completedCharacters = [...alignedCharacters];
  let interpolatedCharacterCount = 0;
  let runStartIndex = 0;

  while (runStartIndex < completedCharacters.length) {
    if (completedCharacters[runStartIndex]) {
      runStartIndex += 1;
      continue;
    }
    let runEndIndex = runStartIndex;
    while (runEndIndex < completedCharacters.length && !completedCharacters[runEndIndex]) {
      runEndIndex += 1;
    }
    const precedingCharacter = runStartIndex > 0 ? completedCharacters[runStartIndex - 1] : undefined;
    const followingCharacter = completedCharacters[runEndIndex];
    const interpolationStartMs = precedingCharacter?.endMs ?? 0;
    const interpolationEndMs = followingCharacter?.startMs ?? durationMs;
    const missingCharacterCount = runEndIndex - runStartIndex;
    for (let offset = 0; offset < missingCharacterCount; offset += 1) {
      const pointMs = interpolationStartMs + ((offset + 1) / (missingCharacterCount + 1)) * (interpolationEndMs - interpolationStartMs);
      const sourceCharacter = sourceCharacters[runStartIndex + offset]!;
      completedCharacters[runStartIndex + offset] = { ...sourceCharacter, startMs: pointMs, endMs: pointMs };
      interpolatedCharacterCount += 1;
    }
    runStartIndex = runEndIndex;
  }

  return {
    characters: completedCharacters as AlignedNarrationCharacter[],
    interpolatedCharacterCount
  };
}

function roundMilliseconds(milliseconds: number): number {
  return Math.max(0, Math.round(milliseconds));
}

function createAlignedTimingMap(
  cards: LocalAlignmentNarrationCard[],
  alignedCharacters: AlignedNarrationCharacter[],
  durationMs: number
): NarrationTimingMap {
  const cardCharacterGroups = cards.map((_, cardIndex) => alignedCharacters.filter((character) => character.cardIndex === cardIndex));
  const cardStarts = cardCharacterGroups.map((characters, cardIndex) => {
    const firstCharacter = characters[0];
    if (!firstCharacter) {
      throw new Error(`Local forced alignment could not resolve narration card ${cards[cardIndex]!.id}.`);
    }
    return cardIndex === 0 ? 0 : roundMilliseconds(firstCharacter.startMs);
  });
  const segments = cards.map((card, cardIndex) => {
    const characters = cardCharacterGroups[cardIndex]!;
    const lastCharacter = characters[characters.length - 1]!;
    const startMs = cardStarts[cardIndex]!;
    const speechEndMs = Math.max(startMs, roundMilliseconds(lastCharacter.endMs));
    const endMs = cardIndex === cards.length - 1
      ? durationMs
      : Math.max(speechEndMs, cardStarts[cardIndex + 1]!);
    return { id: card.id, startMs, speechEndMs, endMs };
  });
  return NarrationTimingMapSchema.parse({
    kind: "narration-timing-map",
    source: "local-forced-alignment",
    durationMs,
    segments
  });
}

function findAlignedNarrationSpeechDensityIssues(
  cards: LocalAlignmentNarrationCard[],
  alignedCharacters: AlignedNarrationCharacter[]
): ReturnType<typeof findNarrationSpeechDensityIssues> {
  const characterGroups = cards.map((_, cardIndex) => (
    alignedCharacters.filter((character) => character.cardIndex === cardIndex)
  ));
  return findNarrationSpeechDensityIssues({
    timingSource: "measured",
    segments: cards.map((card, cardIndex) => {
      const characters = characterGroups[cardIndex]!;
      const firstCharacter = characters[0]!;
      const lastCharacter = characters.at(-1)!;
      return {
        id: card.id,
        text: card.narrationText,
        startMs: roundMilliseconds(firstCharacter.startMs),
        speechEndMs: roundMilliseconds(lastCharacter.endMs)
      };
    })
  });
}

function assertAlignedNarrationSpeechDensity(
  cards: LocalAlignmentNarrationCard[],
  alignedCharacters: AlignedNarrationCharacter[]
): void {
  const issues = findAlignedNarrationSpeechDensityIssues(cards, alignedCharacters);
  if (issues.length > 0) {
    throw new Error(`Local forced alignment ${issues[0]!.message}.`);
  }
}

function rebalanceImplausibleNarrationSpans(
  cards: LocalAlignmentNarrationCard[],
  alignedCharacters: AlignedNarrationCharacter[],
  durationMs: number
): RebalancedNarrationAlignment {
  const repairedCharacters = alignedCharacters.map((character) => ({ ...character }));
  const rebalancedSegmentIndexes = new Set<number>();

  // Whisper 的解码时间戳偶尔会把完整短句压缩到几十毫秒。只在前后实测锚点之间局部重排，
  // 并保留质量指标；若窗口总时长也无法承载正文，后续契约仍会拒绝该时间轴。
  for (let pass = 0; pass < cards.length; pass += 1) {
    const issues = findAlignedNarrationSpeechDensityIssues(cards, repairedCharacters);
    const issue = issues[0];
    if (!issue) {
      break;
    }

    let windowStartIndex = issue.segmentIndex > 0 ? issue.segmentIndex - 1 : issue.segmentIndex;
    let windowEndIndex = issue.segmentIndex + 1;
    if (windowStartIndex === issue.segmentIndex && windowEndIndex < cards.length) {
      windowEndIndex += 1;
    }

    let windowCharacters: AlignedNarrationCharacter[] = [];
    let windowStartMs = 0;
    let windowEndMs = 0;
    let foundRepairableWindow = false;
    while (windowStartIndex >= 0 && windowEndIndex <= cards.length) {
      const characterGroups = cards.map((_, cardIndex) => (
        repairedCharacters.filter((character) => character.cardIndex === cardIndex)
      ));
      windowCharacters = characterGroups
        .slice(windowStartIndex, windowEndIndex)
        .flat();
      windowStartMs = characterGroups[windowStartIndex]![0]!.startMs;
      windowEndMs = windowEndIndex < cards.length
        ? characterGroups[windowEndIndex]![0]!.startMs
        : durationMs;
      const windowIssues = findNarrationSpeechDensityIssues({
        timingSource: "measured",
        segments: [{
          id: cards.slice(windowStartIndex, windowEndIndex).map((card) => card.id).join("+"),
          text: cards.slice(windowStartIndex, windowEndIndex).map((card) => card.narrationText).join(""),
          startMs: roundMilliseconds(windowStartMs),
          speechEndMs: roundMilliseconds(windowEndMs)
        }]
      });
      if (windowIssues.length === 0) {
        foundRepairableWindow = true;
        break;
      }
      if (windowStartIndex > 0) {
        windowStartIndex -= 1;
      } else if (windowEndIndex < cards.length) {
        windowEndIndex += 1;
      } else {
        break;
      }
    }
    if (!foundRepairableWindow || windowCharacters.length === 0 || windowEndMs <= windowStartMs) {
      break;
    }

    const characterDurationMs = (windowEndMs - windowStartMs) / windowCharacters.length;
    windowCharacters.forEach((character, characterIndex) => {
      character.startMs = windowStartMs + characterDurationMs * characterIndex;
      character.endMs = windowStartMs + characterDurationMs * (characterIndex + 1);
      rebalancedSegmentIndexes.add(character.cardIndex);
    });
  }

  const rebalancedSegmentIds = Array.from(rebalancedSegmentIndexes)
    .sort((left, right) => left - right)
    .map((cardIndex) => cards[cardIndex]!.id);
  const rebalancedCharacterCount = repairedCharacters
    .filter((character) => rebalancedSegmentIndexes.has(character.cardIndex))
    .length;
  return { characters: repairedCharacters, rebalancedCharacterCount, rebalancedSegmentIds };
}

/**
 * 将已知脚本与本地 ASR 的时间锚点做全局编辑距离对齐。识别文本只用于取得时间，画面始终保留 Skill 已确认的原文。
 */
export function createLocalForcedAlignmentTimingMap(
  request: LocalForcedAlignmentTimingMapRequest
): LocalForcedAlignmentTimingMapResult {
  assertPositiveDuration(request.durationMs);
  assertMinimumExactMatchRatio(request.minimumExactMatchRatio);
  const sourceCharacters = expandSourceNarrationCharacters(request.cards);
  const recognizedNarration = expandRecognizedNarrationCharacters(request.tokens, request.durationMs);
  const recognizedCharacters = recognizedNarration.characters;
  const matrix = calculateEditDistanceMatrix(sourceCharacters, recognizedCharacters);
  const alignmentTrace = traceNarrationAlignment(sourceCharacters, recognizedCharacters, matrix);
  const exactMatchRatio = alignmentTrace.exactMatchCharacterCount / sourceCharacters.length;
  if (exactMatchRatio < request.minimumExactMatchRatio) {
    throw new Error(
      `Local forced alignment exact match ratio ${exactMatchRatio.toFixed(3)} is below required ${request.minimumExactMatchRatio.toFixed(3)}.`
    );
  }

  // 对 ASR 漏词只在相邻可靠锚点之间插值，并由调用方记录插值数量，禁止把它静默伪装为实测词级时间。
  const interpolated = interpolateMissingAlignmentCharacters(
    alignmentTrace.alignedCharacters,
    sourceCharacters,
    request.durationMs
  );
  const rebalanced = rebalanceImplausibleNarrationSpans(
    request.cards,
    interpolated.characters,
    request.durationMs
  );
  assertAlignedNarrationSpeechDensity(request.cards, rebalanced.characters);
  return {
    timingMap: createAlignedTimingMap(request.cards, rebalanced.characters, request.durationMs),
    quality: {
      sourceCharacterCount: sourceCharacters.length,
      recognizedCharacterCount: recognizedCharacters.length,
      exactMatchCharacterCount: alignmentTrace.exactMatchCharacterCount,
      interpolatedCharacterCount: interpolated.interpolatedCharacterCount,
      rebalancedCharacterCount: rebalanced.rebalancedCharacterCount,
      rebalancedSegmentIds: rebalanced.rebalancedSegmentIds,
      clampedTerminalTokenCount: recognizedNarration.clampedTerminalTokenCount,
      editDistance: alignmentTrace.editDistance,
      exactMatchRatio
    }
  };
}
