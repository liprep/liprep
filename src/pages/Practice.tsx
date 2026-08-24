import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  db,
  getQuestions,
  recordQuestionAttempt,
  toggleBookmark,
  getBookmarkedIds,
  progressDb,
  getQuestionAttempts,
} from "@/db";
import RichContent from "@/components/RichContent";
import AnswerOption from "@/components/AnswerOption";
import MathReferenceSheet from "@/components/MathReferenceSheet";
import { domainMap, codeToNameMap, difficultyLabelMap } from "@/components/TopicTree";
import type { SatQuestion, AttemptRecord } from "@/types/questions";
import "./Practice.css";

const CHOICE_LABELS = ["A", "B", "C", "D"];

function parseNumericValue(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)(?:\/-?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(trimmed)) {
    return null;
  }
  if (!trimmed.includes("/")) {
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  const [num, den] = trimmed.split("/").map(Number);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

function checkIsCorrect(question: SatQuestion, answer: string): boolean {
  const cleaned = answer.trim().toLowerCase();
  if (question.correct_answer.some((ans) => ans.trim().toLowerCase() === cleaned)) {
    return true;
  }
  if (question.type !== "spr") return false;

  const parsedUser = parseNumericValue(answer);
  if (parsedUser === null) return false;

  return question.correct_answer.some((accepted) => {
    const parsedAccepted = parseNumericValue(accepted);
    return parsedAccepted !== null && Math.abs(parsedUser - parsedAccepted) < 0.000001;
  });
}

function formatAttemptDate(timestamp: number) {
  const d = new Date(timestamp);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimestampDate(ts?: number): string | null {
  if (!ts || !Number.isFinite(ts) || ts <= 0) return null;
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Practice() {
  const { questionId: pathQuestionId } = useParams<{ questionId?: string }>();
  const [searchParams] = useSearchParams();
  const targetQuestionId = pathQuestionId || searchParams.get("id") || searchParams.get("q");

  const [questions, setQuestions] = useState<SatQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [eliminations, setEliminations] = useState<Record<number, string[]>>({});
  const [submittedStatus, setSubmittedStatus] = useState<Record<number, boolean>>({});
  const [bookmarkedSet, setBookmarkedSet] = useState<Set<string>>(new Set());
  const [historyAttempts, setHistoryAttempts] = useState<Record<string, boolean[]>>({});
  const [currentQuestionAttempts, setCurrentQuestionAttempts] = useState<AttemptRecord[]>([]);

  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isReferenceOpen, setIsReferenceOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [showEliminateMode, setShowEliminateMode] = useState(true);

  // Desmos Calculator States
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isCalcDocked, setIsCalcDocked] = useState(false);
  const [calcPosition, setCalcPosition] = useState({ x: 30, y: 70 });
  const [isDraggingCalc, setIsDraggingCalc] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Question Timer
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [isTimerHidden, setIsTimerHidden] = useState(false);
  const [isHighlightMode, setIsHighlightMode] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  const timerSecondsRef = useRef<number>(0);
  timerSecondsRef.current = timerSeconds;

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        let loadedQuestions: SatQuestion[] = [];

        if (targetQuestionId) {
          const directQuestion = await db.questions.get(targetQuestionId.trim());
          if (directQuestion) {
            loadedQuestions = [directQuestion];
          } else {
            const allQ = await db.questions.toArray();
            const matched = allQ.find(
              (q) => q.questionId.toLowerCase() === targetQuestionId.trim().toLowerCase()
            );
            if (matched) {
              loadedQuestions = [matched];
            }
          }
        }

        if (loadedQuestions.length === 0 && !targetQuestionId) {
          loadedQuestions = await getQuestions();
        }

        if (cancelled) return;

        if (loadedQuestions.length === 0) {
          setLoadState("error");
          return;
        }

        setQuestions(loadedQuestions);
        setCurrentIndex(0);

        const bookmarks = await getBookmarkedIds();
        setBookmarkedSet(bookmarks);

        const attempts = await progressDb.attempts.toArray();
        const map: Record<string, boolean[]> = {};
        for (const att of attempts) {
          if (!map[att.questionId]) map[att.questionId] = [];
          map[att.questionId].push(att.isCorrect);
        }
        setHistoryAttempts(map);
        setLoadState("ready");
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoadState("error");
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [targetQuestionId]);

  const currentQ = questions[currentIndex];

  useEffect(() => {
    setTimerSeconds(0);
    setIsTimerRunning(true);
  }, [currentIndex]);

  useEffect(() => {
    if (currentQ?.questionId) {
      getQuestionAttempts(currentQ.questionId).then(setCurrentQuestionAttempts);
    }
  }, [currentQ?.questionId, submittedStatus[currentIndex]]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDraggingCalc || isCalcDocked) return;
      setCalcPosition({
        x: Math.max(10, Math.min(window.innerWidth - 360, e.clientX - dragOffset.x)),
        y: Math.max(60, Math.min(window.innerHeight - 280, e.clientY - dragOffset.y)),
      });
    }
    function handleMouseUp() {
      setIsDraggingCalc(false);
    }
    if (isDraggingCalc) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingCalc, dragOffset, isCalcDocked]);

  // Predictive Highlight & Majority De-highlight Engine
  function handleTextHighlight() {
    if (!isHighlightMode) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const rootEl =
      container.nodeType === Node.ELEMENT_NODE
        ? (container as HTMLElement)
        : container.parentElement;

    if (!rootEl || !rootEl.closest(".stimulus-column, .question-column")) {
      return;
    }

    if (
      rootEl.closest(
        "button, input, textarea, .bb-question-strap, .rationale-container, .attempt-history-container"
      )
    ) {
      return;
    }

    // Target the closest active content container
    const searchScope = (container.nodeType === Node.TEXT_NODE ? container.parentNode : container) as HTMLElement;
    const containerPane = rootEl.closest(".stimulus-column, .question-column") as HTMLElement;
    const effectiveContainer = searchScope || containerPane;

    const treeWalker = document.createTreeWalker(
      effectiveContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
          if (!node.nodeValue || node.nodeValue.length === 0) return NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const textNodes: Text[] = [];
    while (treeWalker.nextNode()) {
      textNodes.push(treeWalker.currentNode as Text);
    }

    if (textNodes.length === 0) return;

    interface NodeSlice {
      node: Text;
      start: number;
      end: number;
      isHighlighted: boolean;
      isStart: boolean;
      isEnd: boolean;
    }

    const slices: NodeSlice[] = [];
    let totalLength = 0;
    let totalHighlightedLength = 0;

    for (const node of textNodes) {
      const isStart = node === range.startContainer;
      const isEnd = node === range.endContainer;

      const start = isStart ? range.startOffset : 0;
      const end = isEnd ? range.endOffset : (node.nodeValue?.length || 0);
      const len = Math.max(0, end - start);

      if (len === 0) continue;

      const isHighlighted = Boolean(node.parentElement?.closest("mark.sat-highlight"));
      slices.push({
        node,
        start,
        end,
        isHighlighted,
        isStart,
        isEnd,
      });

      totalLength += len;
      if (isHighlighted) {
        totalHighlightedLength += len;
      }
    }

    if (totalLength === 0) return;

    // Majority Rule: If strictly more than 50% of the touched selection is already highlighted,
    // the user's intent is to un-highlight. Otherwise, the intent is to highlight.
    const isMajorityHighlighted = totalHighlightedLength > totalLength / 2;

    // Process from back to front to preserve DOM character offsets during splits
    slices.reverse().forEach((slice) => {
      const { node, start, end, isHighlighted, isStart, isEnd } = slice;
      let targetNode = node;

      if (isEnd && end < (targetNode.nodeValue?.length || 0)) {
        targetNode.splitText(end);
      }
      if (isStart && start > 0) {
        targetNode = targetNode.splitText(start);
      }

      if (isMajorityHighlighted) {
        // UN-HIGHLIGHT INTENT: Remove highlight wrapper if present
        if (isHighlighted) {
          const markContainer = targetNode.parentElement?.closest("mark.sat-highlight") as HTMLElement | null;
          if (markContainer && markContainer.parentNode) {
            const parent = markContainer.parentNode;
            if (markContainer.tagName.toLowerCase() === "mark") {
              const children = Array.from(markContainer.childNodes);
              const index = children.indexOf(targetNode);

              if (index > 0) {
                const prevMark = document.createElement("mark");
                prevMark.className = "sat-highlight";
                for (let i = 0; i < index; i++) {
                  prevMark.appendChild(children[i]);
                }
                parent.insertBefore(prevMark, markContainer);
              }

              parent.insertBefore(targetNode, markContainer);

              if (index < children.length - 1) {
                const nextMark = document.createElement("mark");
                nextMark.className = "sat-highlight";
                for (let i = index + 1; i < children.length; i++) {
                  nextMark.appendChild(children[i]);
                }
                parent.insertBefore(nextMark, markContainer);
              }

              parent.removeChild(markContainer);
            }
          }
        }
      } else {
        // HIGHLIGHT INTENT: Wrap unhighlighted text into <mark>
        if (!isHighlighted && targetNode.nodeValue && targetNode.nodeValue.length > 0) {
          if (!targetNode.parentElement?.closest("mark.sat-highlight")) {
            const mark = document.createElement("mark");
            mark.className = "sat-highlight";
            targetNode.parentNode?.insertBefore(mark, targetNode);
            mark.appendChild(targetNode);
          }
        }
      }
    });

    // Clean up empty marks and merge adjacent <mark> tags into continuous highlights
    const allMarks = Array.from(effectiveContainer.querySelectorAll("mark.sat-highlight"));
    allMarks.forEach((mark) => {
      if (!mark.textContent || mark.textContent.length === 0) {
        mark.remove();
        return;
      }
      let next = mark.nextSibling;
      while (
        next &&
        next.nodeType === Node.ELEMENT_NODE &&
        (next as HTMLElement).classList.contains("sat-highlight")
      ) {
        while (next.firstChild) {
          mark.appendChild(next.firstChild);
        }
        const nextElem = next;
        next = next.nextSibling;
        nextElem.remove();
      }
    });

    effectiveContainer.normalize();
    selection.removeAllRanges();
  }

  const currentAnswer = userAnswers[currentIndex] || "";
  const currentElims = eliminations[currentIndex] || [];
  const isSubmitted = submittedStatus[currentIndex] || false;
  const isBookmarked = currentQ ? bookmarkedSet.has(currentQ.questionId) : false;
  const isCorrect = isSubmitted && currentQ ? checkIsCorrect(currentQ, currentAnswer) : false;
  const isMathModule = currentQ?.module === "math";

  const hasStimulus = !isMathModule && Boolean(currentQ?.stimulus);

  const handleNavigate = useCallback((index: number) => {
    setCurrentIndex(index);
    setIsNavOpen(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!currentAnswer || isSubmitted || !currentQ) return;
    const timeSpentSec = Math.max(1, timerSecondsRef.current);
    const correct = checkIsCorrect(currentQ, currentAnswer);

    setSubmittedStatus((prev) => ({ ...prev, [currentIndex]: true }));
    await recordQuestionAttempt(currentQ, currentAnswer, correct, timeSpentSec);

    setHistoryAttempts((prev) => {
      const arr = prev[currentQ.questionId] ? [...prev[currentQ.questionId]] : [];
      arr.push(correct);
      return { ...prev, [currentQ.questionId]: arr };
    });

    const freshAttempts = await getQuestionAttempts(currentQ.questionId);
    setCurrentQuestionAttempts(freshAttempts);
  }, [currentAnswer, isSubmitted, currentQ, currentIndex]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === "textarea") return;

      if (!isSubmitted) {
        if (currentAnswer) {
          e.preventDefault();
          handleSubmit();
        }
      } else {
        if (currentIndex + 1 < questions.length) {
          e.preventDefault();
          handleNavigate(currentIndex + 1);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitted, currentAnswer, currentIndex, questions.length, handleSubmit, handleNavigate]);

  if (loadState === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeContent: "center", fontWeight: 700 }}>
        Loading session…
      </div>
    );
  }

  if (loadState === "error" || questions.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
        <h2>
          {targetQuestionId
            ? `Question "${targetQuestionId}" was not found in local storage.`
            : "No questions found for the chosen filters."}
        </h2>
        <Link to="/filter" className="bluebook-primary-btn">
          Back to Filters
        </Link>
      </div>
    );
  }

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  async function handleToggleBookmark() {
    const nowBookmarked = await toggleBookmark(currentQ.questionId);
    setBookmarkedSet((prev) => {
      const next = new Set(prev);
      if (nowBookmarked) next.add(currentQ.questionId);
      else next.delete(currentQ.questionId);
      return next;
    });
  }

  function handleSelectOption(choice: string) {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({ ...prev, [currentIndex]: choice }));
  }

  function handleToggleEliminate(choice: string) {
    if (isSubmitted) return;
    setEliminations((prev) => {
      const current = prev[currentIndex] || [];
      const updated = current.includes(choice)
        ? current.filter((c) => c !== choice)
        : [...current, choice];
      return { ...prev, [currentIndex]: updated };
    });

    if (currentAnswer === choice) {
      setUserAnswers((prev) => ({ ...prev, [currentIndex]: "" }));
    }
  }

  const createdFormatted = formatTimestampDate(currentQ?.createDate);
  const updatedFormatted = formatTimestampDate(currentQ?.updateDate);
  const showUpdated =
    updatedFormatted &&
    (!createdFormatted ||
      (currentQ?.createDate &&
        currentQ?.updateDate &&
        Math.abs(currentQ.createDate - currentQ.updateDate) > 60000 &&
        createdFormatted !== updatedFormatted));

  return (
    <div className="bluebook-app-container">
      {/* Top Header Bar */}
      <header className="bluebook-top-bar">
        <div className="top-bar-left-cluster">
          <span className="section-title-badge">
            {isMathModule ? "Section 2: Math" : "Section 1: Reading and Writing"}
          </span>
        </div>

        {/* Dead Center Timer */}
        <div className="top-bar-center-dead-center">
          <div className="timer-pill-group">
            <button
              type="button"
              className="timer-pill"
              onClick={() => setIsTimerHidden(!isTimerHidden)}
              title="Toggle timer visibility"
            >
              <span>⏱</span>
              <span>{isTimerHidden ? "Show" : formatTimer(timerSeconds)}</span>
            </button>
            <button
              type="button"
              className="timer-pause-btn"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              title={isTimerRunning ? "Pause timer" : "Resume timer"}
            >
              {isTimerRunning ? "⏸" : "▶"}
            </button>
          </div>
        </div>

        <div className="top-bar-tools">
          {!isMathModule && (
            <button
              type="button"
              className={`tool-button ${isHighlightMode ? "active" : ""}`}
              onClick={() => setIsHighlightMode(!isHighlightMode)}
            >
              🖍 <span className="btn-label-responsive">Highlight</span>
            </button>
          )}

          {isMathModule && (
            <button
              type="button"
              className={`tool-button ${isCalculatorOpen ? "active" : ""}`}
              onClick={() => setIsCalculatorOpen(!isCalculatorOpen)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="16" y1="14" x2="16" y2="18" />
                <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
              </svg>
              <span className="btn-label-responsive">Calculator</span>
            </button>
          )}

          {isMathModule && (
            <button
              type="button"
              className="tool-button"
              onClick={() => setIsReferenceOpen(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 22h20M2 22l10-18 10 18M7 13h10" />
              </svg>
              <span className="btn-label-responsive">Reference</span>
            </button>
          )}

          <button
            type="button"
            className="tool-button"
            onClick={() => setIsInfoOpen(true)}
          >
            ⓘ <span className="btn-label-responsive">Info</span>
          </button>

          <Link to="/filter" className="tool-button exit-btn" style={{ textDecoration: "none" }}>
            ✕
          </Link>
        </div>
      </header>

      {/* Main Viewport */}
      <div
        className={`bluebook-viewport ${
          !hasStimulus && !(isCalculatorOpen && isCalcDocked) ? "no-stimulus" : ""
        }`}
        onMouseUp={handleTextHighlight}
      >
        {isCalculatorOpen && isCalcDocked ? (
          <aside className="stimulus-column docked-desmos-pane">
            <div className="docked-desmos-header">
              <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#082A4D" }}>
                Desmos SAT Calculator
              </span>
              <button
                type="button"
                className="tool-button"
                style={{ padding: "3px 8px", fontSize: "0.8rem" }}
                onClick={() => setIsCalcDocked(false)}
              >
                ⤢ Undock (Float)
              </button>
            </div>
            <div className="docked-calc-slot" />
          </aside>
        ) : (
          hasStimulus && (
            <aside className="stimulus-column">
              <RichContent content={currentQ.stimulus} />
            </aside>
          )
        )}

        <main className="question-column">
          {/* Question Strap */}
          <div className="bb-question-strap">
            <div className="bb-strap-left">
              <div className="bb-number-square">{currentIndex + 1}</div>
              <button
                type="button"
                className={`bb-mark-review-btn ${isBookmarked ? "is-marked" : ""}`}
                onClick={handleToggleBookmark}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill={isBookmarked ? "#D97706" : "none"} stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>Mark for Review</span>
              </button>
            </div>

            <div className="bb-strap-right">
              {currentQ.type === "mcq" && (
                <button
                  type="button"
                  className={`bb-mode-tool-btn ${showEliminateMode ? "is-active" : ""}`}
                  onClick={() => setShowEliminateMode(!showEliminateMode)}
                  title="Toggle Option Elimination"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Mobile EBRW Stimulus (Passage) placed right under the question strap */}
          {hasStimulus && (
            <div className="mobile-stimulus">
              <RichContent content={currentQ.stimulus} />
            </div>
          )}

          {isMathModule && currentQ.stimulus && (
            <RichContent content={currentQ.stimulus} className="stem-container" />
          )}

          <RichContent content={currentQ.stem} className="stem-container" />

          {currentQ.type === "mcq" ? (
            <div style={{ marginTop: "14px" }}>
              {currentQ.answerOptions.map((opt, i) => {
                const label = CHOICE_LABELS[i] || String(i + 1);
                return (
                  <AnswerOption
                    key={opt.id}
                    label={label}
                    content={opt.content}
                    selected={currentAnswer === label}
                    eliminated={currentElims.includes(label)}
                    revealed={isSubmitted}
                    isCorrect={checkIsCorrect(currentQ, label)}
                    showEliminateMode={showEliminateMode}
                    onSelect={() => handleSelectOption(label)}
                    onToggleEliminate={() => handleToggleEliminate(label)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="spr-container">
              <label className="spr-label" htmlFor="spr-input">
                Student-Produced Response
              </label>
              <input
                id="spr-input"
                className={`spr-input ${
                  isSubmitted ? (isCorrect ? "is-correct" : "is-incorrect") : ""
                }`}
                type="text"
                maxLength={7}
                placeholder="e.g. 3/4 or 0.75"
                disabled={isSubmitted}
                value={currentAnswer}
                onChange={(e) =>
                  setUserAnswers((prev) => ({
                    ...prev,
                    [currentIndex]: e.target.value.replace(/[^\d./-]/g, ""),
                  }))
                }
              />
              {isSubmitted && (
                <div
                  className="spr-feedback"
                  style={{ color: isCorrect ? "var(--color-green-text)" : "var(--color-coral-text)" }}
                >
                  {isCorrect
                    ? "✓ Correct answer"
                    : `✕ Incorrect. Accepted: ${currentQ.correct_answer.join(", ")}`}
                </div>
              )}
            </div>
          )}

          {/* Answer Explanation & Rationale */}
          {isSubmitted && currentQ.rationale && (
            <details className="rationale-container" open>
              <summary className="rationale-summary">Answer Explanation & Rationale</summary>
              <div className="rationale-body">
                <RichContent content={currentQ.rationale} />
              </div>
            </details>
          )}

          {/* Expandable Previous Attempts History */}
          {isSubmitted && currentQuestionAttempts.length > 0 && (
            <details className="attempt-history-container">
              <summary className="attempt-history-summary">
                <span>Previous Attempts ({currentQuestionAttempts.length})</span>
                <span style={{ fontSize: "0.82rem", color: "#64748B" }}>
                  {currentQuestionAttempts.some((a) => a.isCorrect) ? "Solved ✓" : "Unsolved ✕"}
                </span>
              </summary>
              <div className="attempt-history-body">
                {currentQuestionAttempts.map((att, idx) => (
                  <div key={att.id || idx} className="attempt-history-item">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span
                        className={`attempt-item-badge ${
                          att.isCorrect ? "is-correct" : "is-incorrect"
                        }`}
                      >
                        {att.isCorrect ? "✓ Correct" : "✕ Incorrect"}
                      </span>
                      <span style={{ fontWeight: 700 }}>Answer: {att.userAnswer}</span>
                    </div>
                    <div className="attempt-meta-info">
                      <span>⏱ {att.timeSpentSeconds}s</span>
                      <span>{formatAttemptDate(att.solvedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </main>
      </div>

      {/* Floating / Docked Desmos */}
      <div
        className={`desmos-persistent-frame ${
          isCalculatorOpen ? (isCalcDocked ? "frame-docked" : "frame-floating") : "frame-hidden"
        }`}
        style={
          isCalculatorOpen && !isCalcDocked
            ? { transform: `translate3d(${calcPosition.x}px, ${calcPosition.y}px, 0)` }
            : undefined
        }
      >
        <div
          className="desmos-window-header"
          onMouseDown={(e) => {
            if (isCalcDocked) return;
            setIsDraggingCalc(true);
            setDragOffset({
              x: e.clientX - calcPosition.x,
              y: e.clientY - calcPosition.y,
            });
          }}
        >
          <div className="desmos-window-title">
            <span style={{ fontWeight: 800 }}>Desmos</span>
            <span style={{ fontSize: "0.75rem", background: "#CBD5E1", color: "#0F172A", padding: "2px 6px", borderRadius: "4px" }}>
              SAT Graphing
            </span>
          </div>
          <div className="desmos-window-controls">
            {!isCalcDocked ? (
              <button
                type="button"
                className="desmos-control-btn"
                onClick={() => setIsCalcDocked(true)}
              >
                ⤓ Dock
              </button>
            ) : (
              <button
                type="button"
                className="desmos-control-btn"
                onClick={() => setIsCalcDocked(false)}
              >
                ⤢ Float
              </button>
            )}
            <button
              type="button"
              className="desmos-control-btn"
              onClick={() => setIsCalculatorOpen(false)}
            >
              ✕
            </button>
          </div>
        </div>
        <iframe
          src="/desmos.html"
          className="desmos-iframe-embed"
          title="Desmos Graphing Calculator"
        />
      </div>

      {/* Bottom Bar */}
      <footer className="bluebook-bottom-bar">
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="question-nav-popover-btn"
            onClick={() => setIsNavOpen(!isNavOpen)}
          >
            <span>Question {currentIndex + 1} of {questions.length}</span>
            <span>{isNavOpen ? "▲" : "▼"}</span>
          </button>

          {/* Question Review Grid Popover */}
          {isNavOpen && (
            <div className="bb-review-sheet">
              <div className="bb-review-header">
                <span className="bb-review-title">Question Bank</span>
                <button
                  type="button"
                  className="bb-review-close-btn"
                  onClick={() => setIsNavOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="bb-review-legend">
                <div className="bb-legend-item">
                  <span className="bb-legend-icon legend-icon-correct">✓</span>
                  <span>Correct</span>
                </div>
                <div className="bb-legend-item">
                  <span className="bb-legend-icon legend-icon-incorrect">✕</span>
                  <span>Incorrect</span>
                </div>
                <div className="bb-legend-item">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#D97706" stroke="#D97706" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>For Review</span>
                </div>
                <div className="bb-legend-item">
                  <span className="bb-legend-icon legend-icon-retried">●</span>
                  <span>Upsolved (retried)</span>
                </div>
              </div>

              <div className="bb-review-grid">
                {questions.map((q, idx) => {
                  const isCur = idx === currentIndex;
                  const isBm = bookmarkedSet.has(q.questionId);
                  const isSub = submittedStatus[idx];
                  const isQCorrect = isSub && checkIsCorrect(q, userAnswers[idx] || "");

                  const history = historyAttempts[q.questionId] || [];
                  const hadIncorrect = history.includes(false);
                  const isRetriedCorrect = (isQCorrect || history.includes(true)) && hadIncorrect;

                  const diffColorClass =
                    q.score_band_range_cd <= 3
                      ? "diff-easy"
                      : q.score_band_range_cd <= 5
                      ? "diff-med"
                      : "diff-hard";

                  return (
                    <button
                      key={q.questionId}
                      type="button"
                      className={`bb-grid-cell ${diffColorClass} ${isCur ? "is-current-cell" : ""}`}
                      onClick={() => handleNavigate(idx)}
                    >
                      <div className="bb-cell-top-icons">
                        {isBm && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="#D97706" stroke="#D97706" strokeWidth="2" className="bb-cell-bookmark">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                          </svg>
                        )}
                        {isSub && isRetriedCorrect && (
                          <span className="bb-status-badge badge-retried">●</span>
                        )}
                        {isSub && !isRetriedCorrect && isQCorrect && (
                          <span className="bb-status-badge badge-correct">✓</span>
                        )}
                        {isSub && !isQCorrect && (
                          <span className="bb-status-badge badge-incorrect">✕</span>
                        )}
                      </div>

                      <span className="bb-cell-number">{idx + 1}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          {!isSubmitted ? (
            <button
              type="button"
              className="bluebook-primary-btn"
              disabled={!currentAnswer}
              onClick={handleSubmit}
            >
              Check Answer <span className="enter-key-badge">↵</span>
            </button>
          ) : currentIndex + 1 < questions.length ? (
            <button
              type="button"
              className="bluebook-primary-btn"
              onClick={() => handleNavigate(currentIndex + 1)}
            >
              Next <span className="enter-key-badge">↵</span>
            </button>
          ) : (
            <Link to="/filter" className="bluebook-primary-btn" style={{ textDecoration: "none" }}>
              Finish Session ✓
            </Link>
          )}
        </div>
      </footer>

      {isReferenceOpen && (
        <MathReferenceSheet onClose={() => setIsReferenceOpen(false)} />
      )}

      {isInfoOpen &&
        createPortal(
          <div className="full-screen-blur-overlay" onClick={() => setIsInfoOpen(false)}>
            <div className="about-modal-card animate-fade-in" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ fontSize: "1.25rem", fontWeight: 800 }}>Question Info</h3>
                <button type="button" className="retro-btn" style={{ padding: "4px 10px" }} onClick={() => setIsInfoOpen(false)}>
                  ✕
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.95rem", marginTop: "14px" }}>
                <div><strong>Question ID:</strong> <code>{currentQ.questionId}</code></div>
                <div><strong>Section:</strong> {currentQ.module === "math" ? "Math" : "Reading and Writing"}</div>
                <div><strong>Domain:</strong> {domainMap[currentQ.primary_class_cd || ""] || currentQ.primary_class_cd || "—"}</div>
                <div><strong>Skill:</strong> {codeToNameMap[currentQ.skill_cd] || currentQ.skill_cd}</div>
                <div><strong>Score Band:</strong> {currentQ.score_band_range_cd} / 7</div>
                <div><strong>Difficulty:</strong> {difficultyLabelMap[currentQ.difficulty || ""] || currentQ.difficulty}</div>
                <div><strong>Item Type:</strong> {currentQ.type === "mcq" ? "Multiple Choice" : "Student-Produced Response"}</div>
                {createdFormatted && (
                  <div><strong>Created:</strong> {createdFormatted}</div>
                )}
                {showUpdated && (
                  <div><strong>Updated:</strong> {updatedFormatted}</div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
