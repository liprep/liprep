export type QuestionType = "mcq" | "spr";
export type DifficultyLevel = "E" | "M" | "H";
export type ModuleType = "math" | "reading";

export interface AnswerOption {
  id: string;
  content: string;
}

export interface SatQuestion {
  questionId: string;
  createDate?: number;
  updateDate?: number;
  primary_class_cd?: string;
  skill_cd: string;
  score_band_range_cd: number; // 1 - 7
  difficulty?: DifficultyLevel | string;
  module: ModuleType | string;
  type: QuestionType;
  stimulus: string | null;
  stem: string;
  answerOptions: AnswerOption[];
  correct_answer: string[];
  rationale: string;
}

export interface AttemptRecord {
  id?: number;
  questionId: string;
  module: string;
  primary_class_cd?: string;
  skill_cd: string;
  score_band_range_cd: number;
  userAnswer: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
  solvedAt: number; // Exact Unix timestamp (ms)
  dateKey: string;
}

export interface BookmarkRecord {
  questionId: string;
  bookmarkedAt: number;
}

export interface FilterState {
  subtopics: string[];
  difficultyLevels: number[];
  solvedStatus: "all" | "unsolved" | "incorrect" | "bookmarked";
  excludeBluebook: boolean;
}

export interface SkillPerformance {
  code: string;
  name: string;
  domainCode: string;
  module: string;
  totalAttempts: number;
  uniqueQuestions: number;
  firstTryCorrect: number;
  firstTryAccuracyPct: number;
  overallAccuracyPct: number;
  avgTimeSeconds: number;
}

export interface DomainPerformance {
  code: string;
  name: string;
  module: string;
  totalAttempts: number;
  uniqueQuestions: number;
  firstTryCorrect: number;
  firstTryAccuracyPct: number;
  overallAccuracyPct: number;
  avgTimeSeconds: number;
  skills?: SkillPerformance[];
}

export interface ModuleSectionStats {
  uniqueAttempted: number;
  uniqueCorrect: number;
  uniqueIncorrect: number;
  upsolvedCount: number;
  firstTryAccuracyPct: number;
  overallAccuracyPct: number;
  avgTimeSeconds: number;
  totalTimeSeconds: number;
  domains: Record<string, DomainPerformance>;
  difficultyStats: Record<
    number,
    {
      attempted: number;
      correct: number;
      accuracyPct: number;
      avgTimeSeconds: number;
    }
  >;
}

export interface UserStats {
  totalAttemptsCount: number;
  uniqueQuestionsAttempted: number;
  uniqueCorrect: number;
  uniqueIncorrect: number;
  totalUpsolvedCount: number;
  firstTryOverallAccuracyPct: number;
  overallAccuracyPct: number;
  avgTimeSeconds: number;
  currentStreakDays: number;
  today: {
    ebrwSolved: number;
    mathSolved: number;
    totalTimeSeconds: number;
  };
  ebrw: ModuleSectionStats;
  math: ModuleSectionStats;
  difficultyStats: Record<
    number,
    {
      attempted: number;
      correct: number;
      accuracyPct: number;
      avgTimeSeconds: number;
    }
  >;
  domainStats: Record<string, DomainPerformance>;
  skillStats: Record<string, SkillPerformance>;
  weakestSkills: Array<{
    code: string;
    name: string;
    module: string;
    accuracyPct: number;
    attempted: number;
    avgTime: number;
  }>;
  strongestSkills: Array<{
    code: string;
    name: string;
    module: string;
    accuracyPct: number;
    attempted: number;
    avgTime: number;
  }>;
}