import Dexie, { type EntityTable } from "dexie";
import type { ChangeEvent } from "react";
import bluebookIdsRaw from "./data/bluebook_ids.json";
import { topicCodes, codeToNameMap, domainMap, getDifficultyTierFromScoreBand } from "./components/TopicTree";
import type {
  AnswerOption,
  AttemptRecord,
  BookmarkRecord,
  SatQuestion,
  UserStats,
  FilterState,
  DomainPerformance,
  SkillPerformance,
  ModuleSectionStats,
} from "./types/questions";

export const BLUEBOOK_IDS = new Set<string>(bluebookIdsRaw as string[]);

export const db = new Dexie("LiPrepQuestionsDB") as Dexie & {
  questions: EntityTable<SatQuestion, "questionId">;
};

export const progressDb = new Dexie("LiPrepProgressDB") as Dexie & {
  attempts: EntityTable<AttemptRecord, "id">;
  bookmarks: EntityTable<BookmarkRecord, "questionId">;
};

db.version(1).stores({
  questions:
    "questionId, score_band_range_cd, skill_cd, module, [skill_cd+score_band_range_cd]",
});

progressDb.version(2).stores({
  attempts:
    "++id, questionId, module, skill_cd, score_band_range_cd, isCorrect, solvedAt, dateKey, [skill_cd+score_band_range_cd]",
  bookmarks: "questionId, bookmarkedAt",
});

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeOptions(value: unknown): AnswerOption[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((option, index) => {
      if (typeof option === "string" && option.trim()) {
        return [{ id: String.fromCharCode(65 + index), content: option.trim() }];
      }
      if (isRecord(option)) {
        const content = asString(option.content || option.body || option.text);
        if (!content) return [];
        const id = asString(option.id || option.label) || String.fromCharCode(65 + index);
        return [{ id: id.toUpperCase(), content }];
      }
      return [];
    });
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    const sorted = entries.sort(([a], [b]) => a.localeCompare(b));
    return sorted.flatMap(([key, val], index) => {
      const id = key.length === 1 ? key.toUpperCase() : String.fromCharCode(65 + index);
      if (typeof val === "string" && val.trim()) {
        return [{ id, content: val.trim() }];
      }
      if (isRecord(val)) {
        const content = asString(val.body || val.content || val.text);
        if (!content) return [];
        return [{ id, content }];
      }
      return [];
    });
  }
  return [];
}

function normalizeAnswers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => asString(item).toUpperCase())
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string" || typeof value === "number") {
    const s = asString(value).toUpperCase();
    return s ? [s] : [];
  }
  return [];
}

function parseWrittenFraction(text: string): string | null {
  const wordsToNumbers: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
    eighteen: 18, nineteen: 19, twenty: 20,
  };

  const fractionDenominators: Record<string, number> = {
    half: 2, halves: 2,
    third: 3, thirds: 3,
    fourth: 4, fourths: 4, quarter: 4, quarters: 4,
    fifth: 5, fifths: 5,
    sixth: 6, sixths: 6,
    seventh: 7, sevenths: 7,
    eighth: 8, eighths: 8,
    ninth: 9, ninths: 9,
    tenth: 10, tenths: 10,
    twelfth: 12, twelfths: 12,
    sixteenth: 16, sixteenths: 16,
  };

  const cleaned = text.trim().toLowerCase().replace(/-/g, " ");
  const tokens = cleaned.split(/\s+/);
  if (tokens.length === 2 && wordsToNumbers[tokens[0]] !== undefined && fractionDenominators[tokens[1]]) {
    return `${wordsToNumbers[tokens[0]]}/${fractionDenominators[tokens[1]]}`;
  }
  return null;
}

function extractSprAnswerFromRationale(rationaleHtml: string): string[] {
  if (!rationaleHtml) return [];

  const fracMatches = Array.from(
    rationaleHtml.matchAll(/\\frac\{([+-]?\d+)\}\{([1-9]\d*)\}/gi)
  );
  if (fracMatches.length > 0) {
    const answers = fracMatches.map((m) => `${m[1]}/${m[2]}`);
    return Array.from(new Set(answers));
  }

  const plainText = rationaleHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#8722;|&minus;/gi, "-")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();

  const standardMatch = plainText.match(
    /(?:the\s+)?correct answer(?:s)?\s*(?:is|are)\s*(?:either\s*)?([+-]?(?:\d+\.?\d*|\.\d+)(?:\/[+-]?(?:\d+\.?\d*|\.\d+))?)/i
  );
  if (standardMatch) {
    let ans = standardMatch[1].trim();
    if (ans.endsWith(".")) ans = ans.slice(0, -1);
    if (ans) return [ans];
  }

  const multiMatch = plainText.match(
    /(?:the\s+)?correct answer(?:s)?\s*(?:is|are)\s*(?:either\s*)?((?:[+-]?(?:\d+\.?\d*|\.\d+)(?:\/[+-]?(?:\d+\.?\d*|\.\d+))?\s*(?:,|or|and)\s*)+[+-]?(?:\d+\.?\d*|\.\d+)(?:\/[+-]?(?:\d+\.?\d*|\.\d+))?)/i
  );
  if (multiMatch) {
    const rawAnswers = multiMatch[1].split(/(?:,\s*|\s+or\s+|\s+and\s+)/i);
    const answers = rawAnswers
      .map((a) => a.trim().replace(/\.$/, ""))
      .filter((a) => /^[+-]?(?:\d+\.?\d*|\.\d+)(?:\/[+-]?(?:\d+\.?\d*|\.\d+))?$/.test(a));
    if (answers.length > 0) return Array.from(new Set(answers));
  }

  const wordsMatch = plainText.match(
    /(?:the\s+)?correct answer\s*(?:is|are)\s*(?:either\s*)?([a-z]+(?:-[a-z]+|\s+[a-z]+))/i
  );
  if (wordsMatch) {
    const parsed = parseWrittenFraction(wordsMatch[1]);
    if (parsed) return [parsed];
  }

  const genericMatch = plainText.match(/correct answer[^\d+-]*([+-]?(?:\d+\.?\d*|\.\d+)(?:\/[+-]?(?:\d+\.?\d*|\.\d+))?)/i);
  if (genericMatch) {
    let ans = genericMatch[1].trim().replace(/\.$/, "");
    if (ans) return [ans];
  }

  return [];
}

function normalizeDisclosedQuestion(value: JsonRecord, contentObj: JsonRecord): SatQuestion | null {
  const disclosedDataRaw = contentObj._disclosed_data ?? value._disclosed_data;
  const disclosedDataArray = Array.isArray(disclosedDataRaw)
    ? disclosedDataRaw
    : isRecord(disclosedDataRaw)
      ? Object.values(disclosedDataRaw)
      : [];

  if (disclosedDataArray.length === 0 || !isRecord(disclosedDataArray[0])) {
    return null;
  }

  const data = disclosedDataArray[0] as JsonRecord;
  const questionId = asString(value.questionId || value.uId || data.item_id || value.ibn || value.id);
  const promptText = asString(data.prompt);
  const bodyText = asString(data.body);

  const rawModule = asString(value.module || contentObj.module || data.section).toLowerCase();
  const module = rawModule.includes("math") ? "math" : "reading";

  let stem = "";
  let rawStimulus: string | null = null;

  if (module === "math") {
    if (bodyText && promptText && bodyText !== promptText) {
      stem = `${bodyText}\n${promptText}`;
    } else {
      stem = promptText || bodyText;
    }
    rawStimulus = null;
  } else {
    if (bodyText && promptText && bodyText !== promptText) {
      rawStimulus = bodyText;
      stem = promptText;
    } else {
      stem = promptText || bodyText;
      rawStimulus = null;
    }
  }

  const answerObj = isRecord(data.answer) ? data.answer : {};
  const style = asString(answerObj.style).toLowerCase();
  const hasChoices = Boolean(answerObj.choices && (isRecord(answerObj.choices) || Array.isArray(answerObj.choices)));
  const isMcq = style === "multiple choice" || style === "mcq" || hasChoices;
  const type = isMcq ? "mcq" : "spr";

  let answerOptions: AnswerOption[] = [];
  let correctAnswer: string[] = [];
  const rationale = asString(answerObj.rationale || data.rationale || contentObj.rationale || value.rationale);

  if (isMcq) {
    answerOptions = normalizeOptions(answerObj.choices);
    const rawCorrect = asString(answerObj.correct_choice || answerObj.correct_answer || answerObj.correctChoice);
    if (rawCorrect) {
      correctAnswer = [rawCorrect.toUpperCase()];
    } else if (Array.isArray(answerObj.correct_choice || answerObj.correct_answer)) {
      correctAnswer = normalizeAnswers(answerObj.correct_choice || answerObj.correct_answer);
    }
  } else {
    if (answerObj.correct_answer || answerObj.correct_choice) {
      correctAnswer = normalizeAnswers(answerObj.correct_answer || answerObj.correct_choice);
    }
    if (correctAnswer.length === 0) {
      correctAnswer = extractSprAnswerFromRationale(rationale);
    }
  }

  if (!questionId || !stem) return null;
  if (type === "mcq" && (answerOptions.length === 0 || correctAnswer.length === 0)) return null;
  if (type === "spr" && correctAnswer.length === 0) {
    correctAnswer = ["0"];
  }

  const scoreBand = Math.min(
    7,
    Math.max(1, asNumber(value.score_band_range_cd || contentObj.score_band_range_cd || data.score_band_range_cd, 3))
  );

  let difficulty = asString(value.difficulty || contentObj.difficulty || data.difficulty);
  if (!difficulty) {
    difficulty = getDifficultyTierFromScoreBand(scoreBand);
  } else if (difficulty === "E") difficulty = "Easy";
  else if (difficulty === "M") difficulty = "Medium";
  else if (difficulty === "H") difficulty = "Hard";

  const createDate = asNumber(value.createDate || contentObj.createDate || data.createDate);
  const updateDate = asNumber(value.updateDate || contentObj.updateDate || data.updateDate || createDate);

  return {
    questionId,
    createDate: createDate > 0 ? createDate : undefined,
    updateDate: updateDate > 0 ? updateDate : undefined,
    primary_class_cd: asString(value.primary_class_cd || contentObj.primary_class_cd || data.primary_class_cd),
    skill_cd: asString(value.skill_cd || contentObj.skill_cd || data.skill_cd),
    score_band_range_cd: scoreBand,
    difficulty,
    module,
    type,
    stimulus: rawStimulus && rawStimulus.trim().length > 0 ? rawStimulus : null,
    stem,
    answerOptions,
    correct_answer: correctAnswer,
    rationale,
  };
}

export function normalizeQuestion(value: unknown): SatQuestion | null {
  if (!isRecord(value)) return null;

  let contentObj: JsonRecord = {};
  if (typeof value.content === "string") {
    try {
      const parsed = JSON.parse(value.content);
      if (isRecord(parsed)) contentObj = parsed;
    } catch {}
  } else if (isRecord(value.content)) {
    contentObj = value.content;
  }

  const isDisclosed =
    value._source === "disclosed" ||
    contentObj._source === "disclosed" ||
    Boolean(value._disclosed_data) ||
    Boolean(contentObj._disclosed_data);

  if (isDisclosed) {
    return normalizeDisclosedQuestion(value, contentObj);
  }

  const baseContent = Object.keys(contentObj).length > 0 ? contentObj : value;
  const rawType = asString(value.type || baseContent.type).toLowerCase();
  const type = rawType === "spr" ? "spr" : "mcq";
  const questionId = asString(value.questionId || value.uId || baseContent.questionId || baseContent.uId || value.id);
  let stem = asString(value.stem || baseContent.stem || baseContent.prompt || value.prompt);
  const answerOptions = normalizeOptions(value.answerOptions || baseContent.answerOptions || value.choices || baseContent.choices);
  let correctAnswer = normalizeAnswers(value.correct_answer || baseContent.correct_answer || value.correctAnswer || baseContent.correctAnswer);

  const rationale = asString(value.rationale || baseContent.rationale);

  if (type === "spr" && correctAnswer.length === 0) {
    correctAnswer = extractSprAnswerFromRationale(rationale);
    if (correctAnswer.length === 0) correctAnswer = ["0"];
  }

  if (!questionId || !stem) return null;
  if (type === "mcq" && (answerOptions.length === 0 || correctAnswer.length === 0)) return null;

  let rawStimulus = value.stimulus ?? baseContent.stimulus;
  const scoreBand = Math.min(
    7,
    Math.max(1, asNumber(value.score_band_range_cd || baseContent.score_band_range_cd, 3))
  );

  let difficulty = asString(value.difficulty || baseContent.difficulty);
  if (!difficulty) {
    difficulty = getDifficultyTierFromScoreBand(scoreBand);
  } else if (difficulty === "E") difficulty = "Easy";
  else if (difficulty === "M") difficulty = "Medium";
  else if (difficulty === "H") difficulty = "Hard";

  const rawModule = asString(value.module || baseContent.module).toLowerCase();
  const module = rawModule.includes("math") ? "math" : "reading";

  if (module === "math") {
    if (rawStimulus && typeof rawStimulus === "string" && rawStimulus.trim().length > 0) {
      stem = `${rawStimulus}\n${stem}`;
    }
    rawStimulus = null;
  } else {
    if (rawStimulus && typeof rawStimulus === "string") {
      const stimTrim = rawStimulus.trim();
      if (stem.trim().startsWith(stimTrim)) {
        stem = stem.trim().slice(stimTrim.length).trim();
      }
    }
  }

  const createDate = asNumber(value.createDate || baseContent.createDate);
  const updateDate = asNumber(value.updateDate || baseContent.updateDate || createDate);

  return {
    questionId,
    createDate: createDate > 0 ? createDate : undefined,
    updateDate: updateDate > 0 ? updateDate : undefined,
    primary_class_cd: asString(value.primary_class_cd || baseContent.primary_class_cd),
    skill_cd: asString(value.skill_cd || baseContent.skill_cd),
    score_band_range_cd: scoreBand,
    difficulty,
    module,
    type,
    stimulus: typeof rawStimulus === "string" && rawStimulus.trim().length > 0 ? rawStimulus : null,
    stem,
    answerOptions,
    correct_answer: correctAnswer,
    rationale,
  };
}

export async function parseAndIngestJSON(file: File): Promise<number> {
  const text = await file.text();
  const json: unknown = JSON.parse(text);

  const candidateQuestions: unknown[] = Array.isArray(json)
    ? json
    : isRecord(json) && (Array.isArray(json.questions) || isRecord(json.questions))
      ? Array.isArray(json.questions)
        ? json.questions
        : Object.values(json.questions)
      : isRecord(json)
        ? Object.values(json)
        : [];

  const validQuestions: SatQuestion[] = [];
  const seenIds = new Set<string>();

  for (const raw of candidateQuestions) {
    const normalized = normalizeQuestion(raw);
    if (normalized) {
      let uniqueId = normalized.questionId;
      if (seenIds.has(uniqueId)) {
        if (isRecord(raw) && typeof raw.uId === "string" && !seenIds.has(raw.uId)) {
          uniqueId = raw.uId;
          normalized.questionId = uniqueId;
        } else {
          uniqueId = `${uniqueId}_${seenIds.size}`;
          normalized.questionId = uniqueId;
        }
      }
      seenIds.add(uniqueId);
      validQuestions.push(normalized);
    }
  }

  if (validQuestions.length === 0) {
    throw new Error("No valid SAT questions found in this file.");
  }

  await db.transaction("rw", db.questions, async () => {
    await db.questions.clear();
    await db.questions.bulkPut(validQuestions);
  });

  return validQuestions.length;
}

export async function handleJSONUpload(event: ChangeEvent<HTMLInputElement>): Promise<number> {
  const file = event.target.files?.[0];
  if (!file) return 0;
  return parseAndIngestJSON(file);
}

export async function getStoredQuestionCount(): Promise<number> {
  try {
    return await db.questions.count();
  } catch {
    return 0;
  }
}

export function formatDateKey(timestamp: number | Date = Date.now()): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function toggleBookmark(questionId: string): Promise<boolean> {
  const existing = await progressDb.bookmarks.get(questionId);
  if (existing) {
    await progressDb.bookmarks.delete(questionId);
    return false;
  } else {
    await progressDb.bookmarks.put({ questionId, bookmarkedAt: Date.now() });
    return true;
  }
}

export async function getBookmarkedIds(): Promise<Set<string>> {
  const all = await progressDb.bookmarks.toArray();
  return new Set(all.map((b) => b.questionId));
}

export async function getQuestions(customFilter?: FilterState): Promise<SatQuestion[]> {
  const allQuestions = await db.questions.toArray();
  const filtersString = !customFilter ? sessionStorage.getItem("filters") : null;
  const filters: FilterState = customFilter ?? (filtersString ? JSON.parse(filtersString) : {
    subtopics: [],
    difficultyLevels: [],
    solvedStatus: "all",
    excludeBluebook: true,
  });

  const selectedTopics = filters.subtopics ?? [];
  const selectedDifficulties = filters.difficultyLevels ?? [];

  let filtered = allQuestions.filter((question) => {
    if (filters.excludeBluebook && BLUEBOOK_IDS.has(question.questionId)) {
      return false;
    }
    const matchesTopic = selectedTopics.length === 0 || selectedTopics.includes(question.skill_cd);
    const matchesDiff =
      selectedDifficulties.length === 0 ||
      selectedDifficulties.includes(question.score_band_range_cd);
    return matchesTopic && matchesDiff;
  });

  if (filters.solvedStatus === "unsolved") {
    const attempts = await progressDb.attempts.toArray();
    const solvedIds = new Set(attempts.map((a) => a.questionId));
    filtered = filtered.filter((q) => !solvedIds.has(q.questionId));
  } else if (filters.solvedStatus === "incorrect") {
    const attempts = await progressDb.attempts.toArray();
    const latestAttempts = new Map<string, boolean>();
    attempts.forEach((a) => latestAttempts.set(a.questionId, a.isCorrect));
    const incorrectIds = new Set<string>();
    latestAttempts.forEach((isCorrect, qId) => {
      if (!isCorrect) incorrectIds.add(qId);
    });
    filtered = filtered.filter((q) => incorrectIds.has(q.questionId));
  } else if (filters.solvedStatus === "bookmarked") {
    const bookmarkedIds = await getBookmarkedIds();
    filtered = filtered.filter((q) => bookmarkedIds.has(q.questionId));
  }

  return filtered;
}

export async function recordQuestionAttempt(
  question: SatQuestion,
  userAnswer: string,
  isCorrect: boolean,
  timeSpentSeconds: number,
) {
  const now = Date.now();
  await progressDb.attempts.add({
    questionId: question.questionId,
    module: question.module,
    primary_class_cd: question.primary_class_cd,
    skill_cd: question.skill_cd,
    score_band_range_cd: question.score_band_range_cd,
    userAnswer,
    isCorrect,
    timeSpentSeconds: Math.max(1, Math.round(timeSpentSeconds)),
    solvedAt: now,
    dateKey: formatDateKey(now),
  });
}

export async function getQuestionAttempts(questionId: string): Promise<AttemptRecord[]> {
  const attempts = await progressDb.attempts.where("questionId").equals(questionId).toArray();
  return attempts.sort((a, b) => a.solvedAt - b.solvedAt);
}

export async function getActivityHeatmapData(): Promise<Record<string, number>> {
  const attempts = await progressDb.attempts.toArray();
  const heatmap: Record<string, number> = {};
  for (const record of attempts) {
    heatmap[record.dateKey] = (heatmap[record.dateKey] || 0) + 1;
  }
  return heatmap;
}

export async function getNumberRemainingPerTopic(
  difficulty: number[],
  solvedStatus: string,
  excludeBluebook = true,
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const allAttempts = await progressDb.attempts.toArray();
  const bookmarkedIds = await getBookmarkedIds();

  const latestAttempts = new Map<string, boolean>();
  allAttempts.forEach((a) => latestAttempts.set(a.questionId, a.isCorrect));

  const solvedQuestionIds = new Set(allAttempts.map((a) => a.questionId));
  const incorrectQuestionIds = new Set<string>();
  latestAttempts.forEach((isCorrect, qId) => {
    if (!isCorrect) incorrectQuestionIds.add(qId);
  });

  const questions = await db.questions.toArray();

  for (const [fullName, code] of Object.entries(topicCodes)) {
    let matching = questions.filter(
      (q) =>
        q.skill_cd === code &&
        (difficulty.length === 0 || difficulty.includes(q.score_band_range_cd)),
    );

    if (excludeBluebook) {
      matching = matching.filter((q) => !BLUEBOOK_IDS.has(q.questionId));
    }

    if (solvedStatus === "unsolved") {
      result[fullName] = matching.filter((q) => !solvedQuestionIds.has(q.questionId)).length;
    } else if (solvedStatus === "incorrect") {
      result[fullName] = matching.filter((q) => incorrectQuestionIds.has(q.questionId)).length;
    } else if (solvedStatus === "bookmarked") {
      result[fullName] = matching.filter((q) => bookmarkedIds.has(q.questionId)).length;
    } else {
      result[fullName] = matching.length;
    }
  }

  return result;
}

function createEmptyModuleStats(moduleKey: "reading" | "math"): ModuleSectionStats {
  const domains: Record<string, DomainPerformance> = {};
  const relevantDomains =
    moduleKey === "reading" ? ["CAS", "EOI", "INI", "SEC"] : ["H", "P", "Q", "S"];

  for (const dom of relevantDomains) {
    domains[dom] = {
      code: dom,
      name: domainMap[dom] || dom,
      module: moduleKey,
      totalAttempts: 0,
      uniqueQuestions: 0,
      firstTryCorrect: 0,
      firstTryAccuracyPct: 0,
      overallAccuracyPct: 0,
      avgTimeSeconds: 0,
      skills: [],
    };
  }

  const diffStats: ModuleSectionStats["difficultyStats"] = {};
  for (let b = 1; b <= 7; b++) {
    diffStats[b] = { attempted: 0, correct: 0, accuracyPct: 0, avgTimeSeconds: 0 };
  }

  return {
    uniqueAttempted: 0,
    uniqueCorrect: 0,
    uniqueIncorrect: 0,
    upsolvedCount: 0,
    firstTryAccuracyPct: 0,
    overallAccuracyPct: 0,
    avgTimeSeconds: 0,
    totalTimeSeconds: 0,
    domains,
    difficultyStats: diffStats,
  };
}

export async function getUserStatistics(): Promise<UserStats> {
  const rawAttempts = await progressDb.attempts.toArray();
  const attempts = rawAttempts.sort((a, b) => a.solvedAt - b.solvedAt);
  const totalAttemptsCount = attempts.length;
  const todayKey = formatDateKey();

  let todayEbrw = 0;
  let todayMath = 0;
  let todayTimeSec = 0;

  for (const a of attempts) {
    if (a.dateKey === todayKey) {
      if (a.module === "math") todayMath++;
      else todayEbrw++;
      todayTimeSec += a.timeSpentSeconds || 0;
    }
  }

  const globalDifficultyStats: Record<
    number,
    { attempted: number; correct: number; totalTime: number }
  > = {
    1: { attempted: 0, correct: 0, totalTime: 0 },
    2: { attempted: 0, correct: 0, totalTime: 0 },
    3: { attempted: 0, correct: 0, totalTime: 0 },
    4: { attempted: 0, correct: 0, totalTime: 0 },
    5: { attempted: 0, correct: 0, totalTime: 0 },
    6: { attempted: 0, correct: 0, totalTime: 0 },
    7: { attempted: 0, correct: 0, totalTime: 0 },
  };

  const ebrwStats = createEmptyModuleStats("reading");
  const mathStats = createEmptyModuleStats("math");

  const questionAttemptsMap = new Map<string, AttemptRecord[]>();
  for (const a of attempts) {
    const list = questionAttemptsMap.get(a.questionId) || [];
    list.push(a);
    questionAttemptsMap.set(a.questionId, list);
  }

  let uniqueCorrectTotal = 0;
  let uniqueIncorrectTotal = 0;
  let totalUpsolvedCount = 0;
  let firstTryCorrectTotal = 0;
  const totalUniqueAttempted = questionAttemptsMap.size;
  let globalTotalTime = 0;

  const domainAggregates: Record<
    string,
    {
      module: string;
      totalAttempts: number;
      uniqueCount: number;
      firstTryCorrect: number;
      totalCorrect: number;
      totalTime: number;
    }
  > = {};

  ["CAS", "EOI", "INI", "SEC", "H", "P", "Q", "S"].forEach((dom) => {
    domainAggregates[dom] = {
      module: ["CAS", "EOI", "INI", "SEC"].includes(dom) ? "reading" : "math",
      totalAttempts: 0,
      uniqueCount: 0,
      firstTryCorrect: 0,
      totalCorrect: 0,
      totalTime: 0,
    };
  });

  const skillAggregates: Record<
    string,
    {
      name: string;
      domainCode: string;
      module: string;
      attempts: number;
      uniqueCount: number;
      firstTryCorrect: number;
      correct: number;
      totalTime: number;
    }
  > = {};

  questionAttemptsMap.forEach((qAttempts) => {
    const firstAttempt = qAttempts[0];
    const latestAttempt = qAttempts[qAttempts.length - 1];
    const hadFailure = qAttempts.some((att) => !att.isCorrect);
    const isCurrentlyCorrect = latestAttempt.isCorrect;
    const isUpsolved = hadFailure && isCurrentlyCorrect;

    if (firstAttempt.isCorrect) firstTryCorrectTotal++;
    if (isCurrentlyCorrect) uniqueCorrectTotal++;
    else uniqueIncorrectTotal++;
    if (isUpsolved) totalUpsolvedCount++;

    const isMath = firstAttempt.module === "math";
    const modTarget = isMath ? mathStats : ebrwStats;
    modTarget.uniqueAttempted++;
    if (isCurrentlyCorrect) modTarget.uniqueCorrect++;
    else modTarget.uniqueIncorrect++;
    if (isUpsolved) modTarget.upsolvedCount++;

    const domCode = firstAttempt.primary_class_cd;
    if (domCode && domainAggregates[domCode]) {
      domainAggregates[domCode].uniqueCount++;
      if (firstAttempt.isCorrect) {
        domainAggregates[domCode].firstTryCorrect++;
      }
    }

    const sCode = firstAttempt.skill_cd;
    if (sCode) {
      if (!skillAggregates[sCode]) {
        skillAggregates[sCode] = {
          name: codeToNameMap[sCode] || sCode,
          domainCode: firstAttempt.primary_class_cd || "",
          module: firstAttempt.module,
          attempts: 0,
          uniqueCount: 0,
          firstTryCorrect: 0,
          correct: 0,
          totalTime: 0,
        };
      }
      skillAggregates[sCode].uniqueCount++;
      if (firstAttempt.isCorrect) {
        skillAggregates[sCode].firstTryCorrect++;
      }
    }
  });

  for (const a of attempts) {
    const t = a.timeSpentSeconds || 0;
    globalTotalTime += t;

    const isMath = a.module === "math";
    const modTarget = isMath ? mathStats : ebrwStats;
    modTarget.totalTimeSeconds += t;

    if (a.score_band_range_cd >= 1 && a.score_band_range_cd <= 7) {
      const gDiff = globalDifficultyStats[a.score_band_range_cd];
      gDiff.attempted++;
      if (a.isCorrect) gDiff.correct++;
      gDiff.totalTime += t;

      const mDiff = modTarget.difficultyStats[a.score_band_range_cd];
      mDiff.attempted++;
      if (a.isCorrect) mDiff.correct++;
      mDiff.avgTimeSeconds += t;
    }

    if (a.primary_class_cd && domainAggregates[a.primary_class_cd]) {
      const dom = domainAggregates[a.primary_class_cd];
      dom.totalAttempts++;
      if (a.isCorrect) dom.totalCorrect++;
      dom.totalTime += t;
    }

    const sCode = a.skill_cd;
    if (sCode) {
      if (!skillAggregates[sCode]) {
        skillAggregates[sCode] = {
          name: codeToNameMap[sCode] || sCode,
          domainCode: a.primary_class_cd || "",
          module: a.module,
          attempts: 0,
          uniqueCount: 0,
          firstTryCorrect: 0,
          correct: 0,
          totalTime: 0,
        };
      }
      skillAggregates[sCode].attempts++;
      if (a.isCorrect) skillAggregates[sCode].correct++;
      skillAggregates[sCode].totalTime += t;
    }
  }

  const finalGlobalDifficulty: UserStats["difficultyStats"] = {};
  for (let b = 1; b <= 7; b++) {
    const gd = globalDifficultyStats[b];
    finalGlobalDifficulty[b] = {
      attempted: gd.attempted,
      correct: gd.correct,
      accuracyPct: gd.attempted > 0 ? Math.round((gd.correct / gd.attempted) * 100) : 0,
      avgTimeSeconds: gd.attempted > 0 ? Math.round(gd.totalTime / gd.attempted) : 0,
    };

    const md = mathStats.difficultyStats[b];
    mathStats.difficultyStats[b] = {
      attempted: md.attempted,
      correct: md.correct,
      accuracyPct: md.attempted > 0 ? Math.round((md.correct / md.attempted) * 100) : 0,
      avgTimeSeconds: md.attempted > 0 ? Math.round(md.avgTimeSeconds / md.attempted) : 0,
    };

    const ed = ebrwStats.difficultyStats[b];
    ebrwStats.difficultyStats[b] = {
      attempted: ed.attempted,
      correct: ed.correct,
      accuracyPct: ed.attempted > 0 ? Math.round((ed.correct / ed.attempted) * 100) : 0,
      avgTimeSeconds: ed.attempted > 0 ? Math.round(ed.avgTimeSeconds / ed.attempted) : 0,
    };
  }

  const finalSkillStats: Record<string, SkillPerformance> = {};
  for (const [code, sk] of Object.entries(skillAggregates)) {
    finalSkillStats[code] = {
      code,
      name: sk.name,
      domainCode: sk.domainCode,
      module: sk.module,
      totalAttempts: sk.attempts,
      uniqueQuestions: sk.uniqueCount,
      firstTryCorrect: sk.firstTryCorrect,
      firstTryAccuracyPct: sk.uniqueCount > 0 ? Math.round((sk.firstTryCorrect / sk.uniqueCount) * 100) : 0,
      overallAccuracyPct: sk.attempts > 0 ? Math.round((sk.correct / sk.attempts) * 100) : 0,
      avgTimeSeconds: sk.attempts > 0 ? Math.round(sk.totalTime / sk.attempts) : 0,
    };
  }

  const finalDomainStats: Record<string, DomainPerformance> = {};
  for (const [code, dom] of Object.entries(domainAggregates)) {
    const skillsInDomain = Object.values(finalSkillStats).filter(
      (s) => s.domainCode === code || topicCodes[s.name] === code
    );

    const performance: DomainPerformance = {
      code,
      name: domainMap[code] || code,
      module: dom.module,
      totalAttempts: dom.totalAttempts,
      uniqueQuestions: dom.uniqueCount,
      firstTryCorrect: dom.firstTryCorrect,
      firstTryAccuracyPct:
        dom.uniqueCount > 0 ? Math.round((dom.firstTryCorrect / dom.uniqueCount) * 100) : 0,
      overallAccuracyPct:
        dom.totalAttempts > 0 ? Math.round((dom.totalCorrect / dom.totalAttempts) * 100) : 0,
      avgTimeSeconds: dom.totalAttempts > 0 ? Math.round(dom.totalTime / dom.totalAttempts) : 0,
      skills: skillsInDomain,
    };

    finalDomainStats[code] = performance;
    if (dom.module === "math") {
      mathStats.domains[code] = performance;
    } else {
      ebrwStats.domains[code] = performance;
    }
  }

  const mathAttemptsTotal = attempts.filter((a) => a.module === "math");
  const mathCorrectTotal = mathAttemptsTotal.filter((a) => a.isCorrect).length;
  mathStats.overallAccuracyPct =
    mathAttemptsTotal.length > 0
      ? Math.round((mathCorrectTotal / mathAttemptsTotal.length) * 100)
      : 0;
  mathStats.firstTryAccuracyPct =
    mathStats.uniqueAttempted > 0
      ? Math.round(
          (Array.from(questionAttemptsMap.values())
            .filter((list) => list[0]?.module === "math" && list[0]?.isCorrect).length /
            mathStats.uniqueAttempted) *
            100,
        )
      : 0;
  mathStats.avgTimeSeconds =
    mathAttemptsTotal.length > 0 ? Math.round(mathStats.totalTimeSeconds / mathAttemptsTotal.length) : 0;

  const ebrwAttemptsTotal = attempts.filter((a) => a.module !== "math");
  const ebrwCorrectTotal = ebrwAttemptsTotal.filter((a) => a.isCorrect).length;
  ebrwStats.overallAccuracyPct =
    ebrwAttemptsTotal.length > 0
      ? Math.round((ebrwCorrectTotal / ebrwAttemptsTotal.length) * 100)
      : 0;
  ebrwStats.firstTryAccuracyPct =
    ebrwStats.uniqueAttempted > 0
      ? Math.round(
          (Array.from(questionAttemptsMap.values())
            .filter((list) => list[0]?.module !== "math" && list[0]?.isCorrect).length /
            ebrwStats.uniqueAttempted) *
            100,
        )
      : 0;
  ebrwStats.avgTimeSeconds =
    ebrwAttemptsTotal.length > 0 ? Math.round(ebrwStats.totalTimeSeconds / ebrwAttemptsTotal.length) : 0;

  const rankedSkills: UserStats["weakestSkills"] = [];
  for (const sk of Object.values(finalSkillStats)) {
    if (sk.totalAttempts >= 1) {
      rankedSkills.push({
        code: sk.code,
        name: sk.name,
        module: sk.module,
        accuracyPct: sk.firstTryAccuracyPct,
        attempted: sk.totalAttempts,
        avgTime: sk.avgTimeSeconds,
      });
    }
  }

  rankedSkills.sort((a, b) => a.accuracyPct - b.accuracyPct);
  const weakestSkills = rankedSkills.slice(0, 4);
  const strongestSkills = [...rankedSkills].reverse().slice(0, 4);

  const uniqueDates = Array.from(new Set(attempts.map((a) => a.dateKey))).sort();
  let currentStreakDays = 0;
  const yesterdayKey = formatDateKey(Date.now() - 86400000);

  if (uniqueDates.includes(todayKey) || uniqueDates.includes(yesterdayKey)) {
    let checkDate = new Date();
    if (!uniqueDates.includes(todayKey)) {
      checkDate = new Date(Date.now() - 86400000);
    }
    while (true) {
      const key = formatDateKey(checkDate);
      if (uniqueDates.includes(key)) {
        currentStreakDays++;
        checkDate = new Date(checkDate.getTime() - 86400000);
      } else {
        break;
      }
    }
  }

  const allCorrectAttemptsCount = attempts.filter((a) => a.isCorrect).length;

  return {
    totalAttemptsCount,
    uniqueQuestionsAttempted: totalUniqueAttempted,
    uniqueCorrect: uniqueCorrectTotal,
    uniqueIncorrect: uniqueIncorrectTotal,
    totalUpsolvedCount,
    firstTryOverallAccuracyPct:
      totalUniqueAttempted > 0 ? Math.round((firstTryCorrectTotal / totalUniqueAttempted) * 100) : 0,
    overallAccuracyPct:
      totalAttemptsCount > 0 ? Math.round((allCorrectAttemptsCount / totalAttemptsCount) * 100) : 0,
    avgTimeSeconds: totalAttemptsCount > 0 ? Math.round(globalTotalTime / totalAttemptsCount) : 0,
    currentStreakDays,
    today: {
      ebrwSolved: todayEbrw,
      mathSolved: todayMath,
      totalTimeSeconds: todayTimeSec,
    },
    ebrw: ebrwStats,
    math: mathStats,
    difficultyStats: finalGlobalDifficulty,
    domainStats: finalDomainStats,
    skillStats: finalSkillStats,
    weakestSkills,
    strongestSkills,
  };
}

export async function clearAllUserData(): Promise<void> {
  await progressDb.attempts.clear();
  await progressDb.bookmarks.clear();
}

/**
 * Robust .liprep Progress Exporter & Importer
 */
export interface LiPrepExportPayload {
  format: "LiPrep";
  version: number;
  exportedAt: number;
  exportDateStr: string;
  data: {
    attempts: AttemptRecord[];
    bookmarks: BookmarkRecord[];
  };
}

export async function exportUserData(): Promise<string> {
  const attempts = await progressDb.attempts.toArray();
  const bookmarks = await progressDb.bookmarks.toArray();
  const now = new Date();
  const dateStr = formatDateKey(now);

  const payload: LiPrepExportPayload = {
    format: "LiPrep",
    version: 1,
    exportedAt: now.getTime(),
    exportDateStr: dateStr,
    data: {
      attempts: attempts.map((a) => ({
        questionId: a.questionId,
        module: a.module,
        primary_class_cd: a.primary_class_cd,
        skill_cd: a.skill_cd,
        score_band_range_cd: a.score_band_range_cd,
        userAnswer: a.userAnswer,
        isCorrect: a.isCorrect,
        timeSpentSeconds: a.timeSpentSeconds,
        solvedAt: a.solvedAt,
        dateKey: a.dateKey,
      })),
      bookmarks: bookmarks.map((b) => ({
        questionId: b.questionId,
        bookmarkedAt: b.bookmarkedAt,
      })),
    },
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const downloadUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `${dateStr}.liprep`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);

  return `${dateStr}.liprep`;
}

export async function importUserData(file: File): Promise<{ attemptsCount: number; bookmarksCount: number }> {
  const text = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Invalid .liprep file. Could not parse JSON content.");
  }

  if (!isRecord(json) || (json.format !== "LiPrep" && !json.data)) {
    throw new Error("Invalid .liprep backup format.");
  }

  const rawData = (isRecord(json.data) ? json.data : json) as JsonRecord;
  const rawAttempts = Array.isArray(rawData.attempts) ? rawData.attempts : [];
  const rawBookmarks = Array.isArray(rawData.bookmarks) ? rawData.bookmarks : [];

  const validAttempts: AttemptRecord[] = [];
  for (const a of rawAttempts) {
    if (isRecord(a) && typeof a.questionId === "string" && typeof a.isCorrect === "boolean") {
      validAttempts.push({
        questionId: asString(a.questionId),
        module: asString(a.module) || "reading",
        primary_class_cd: asString(a.primary_class_cd),
        skill_cd: asString(a.skill_cd),
        score_band_range_cd: asNumber(a.score_band_range_cd, 3),
        userAnswer: asString(a.userAnswer),
        isCorrect: Boolean(a.isCorrect),
        timeSpentSeconds: asNumber(a.timeSpentSeconds, 1),
        solvedAt: asNumber(a.solvedAt, Date.now()),
        dateKey: asString(a.dateKey) || formatDateKey(),
      });
    }
  }

  const validBookmarks: BookmarkRecord[] = [];
  for (const b of rawBookmarks) {
    if (isRecord(b) && typeof b.questionId === "string") {
      validBookmarks.push({
        questionId: asString(b.questionId),
        bookmarkedAt: asNumber(b.bookmarkedAt, Date.now()),
      });
    }
  }

  await progressDb.transaction("rw", progressDb.attempts, progressDb.bookmarks, async () => {
    await progressDb.attempts.clear();
    await progressDb.bookmarks.clear();
    if (validAttempts.length > 0) {
      await progressDb.attempts.bulkAdd(validAttempts);
    }
    if (validBookmarks.length > 0) {
      await progressDb.bookmarks.bulkPut(validBookmarks);
    }
  });

  return {
    attemptsCount: validAttempts.length,
    bookmarksCount: validBookmarks.length,
  };
}
/**
 * Returns the count of unique questions solved correctly by the student.
 */
export async function getSolvedCount(): Promise<number> {
  try {
    const attempts = await progressDb.attempts.toArray();
    const solvedSet = new Set(
      attempts.filter((a) => a.isCorrect).map((a) => a.questionId)
    );
    return solvedSet.size;
  } catch {
    return 0;
  }
}
export async function getFirstAttemptTimestamp(): Promise<number | null> {
  try {
    const firstAttempt = await progressDb.attempts.orderBy("solvedAt").first();
    if (firstAttempt && typeof firstAttempt.solvedAt === "number" && firstAttempt.solvedAt > 0) {
      return firstAttempt.solvedAt;
    }
    const all = await progressDb.attempts.toArray();
    if (all.length > 0) {
      const timestamps = all.map((a) => a.solvedAt).filter((ts) => typeof ts === "number" && ts > 0);
      if (timestamps.length > 0) {
        return Math.min(...timestamps);
      }
    }
    return null;
  } catch {
    try {
      const all = await progressDb.attempts.toArray();
      if (all.length > 0) {
        const timestamps = all.map((a) => a.solvedAt).filter((ts) => typeof ts === "number" && ts > 0);
        if (timestamps.length > 0) {
          return Math.min(...timestamps);
        }
      }
    } catch {}
    return null;
  }
}
