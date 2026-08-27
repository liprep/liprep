import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import TopicSelection from "@/components/TopicSelection";
import MonthCalendar from "@/components/MonthCalendar";
import AnalyticsModal from "@/components/AnalyticsModal";
import {
  getActivityHeatmapData,
  getUserStatistics,
  clearAllUserData,
} from "@/db";
import { topicCodes } from "@/components/TopicTree";
import type { UserStats } from "@/types/questions";
import "./Filter.css";

const GREETINGS = [
  { main: "Mornin, Habibi", sub: "Let's lock in" },
  { main: "Let's make Hannah proud", sub: "she replies faster when youre 1500+" },
  { main: "Saba7 el 3anbar", sub: "momken el nambar" },
  { main: "Mathaao", sub: "RIP College Board" },
  { main: "Happy grinding", sub: "Consistency eats talent for breakfast" },
  { main: "Lock in", sub: "Distractions off, brain on" },
  { main: "Framemogging SAT", sub: "Show the curve who's boss" },
  { main: "College Board sweating rn", sub: "They ain't ready for this" },
  { main: "Desmos speedrun any%", sub: "ft. Regression" },
  { main: "800 Math loading...", sub: "Load up your desmos" },
  { main: "Bluebook who?", sub: "We practice raw here" },
  { main: "Study Attentively", sub: "seriously, do it" },
  { main: "Rise and shine", sub: "SAT won't conquer itself" },
];

export default function Filter() {
  const navigate = useNavigate();

  const greeting = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * GREETINGS.length);
    return GREETINGS[randomIndex];
  }, []);

  const [difficulty, setDifficulty] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("liprep_saved_difficulty");
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set([1, 2, 3, 4, 5, 6, 7]);
  });

  const [solvedStatus, setSolvedStatus] = useState<"all" | "unsolved" | "incorrect" | "bookmarked">(() => {
    try {
      const saved = localStorage.getItem("liprep_saved_status");
      if (saved && ["all", "unsolved", "incorrect", "bookmarked"].includes(saved)) {
        return saved as any;
      }
    } catch {}
    return "all";
  });

  const [excludeBluebook, setExcludeBluebook] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("liprep_saved_exclude_bb");
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return true;
  });

  const [selected, setSelected] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("liprep_saved_topics");
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set(Object.keys(topicCodes));
  });

  const [activityData, setActivityData] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("liprep_saved_difficulty", JSON.stringify(Array.from(difficulty)));
  }, [difficulty]);

  useEffect(() => {
    localStorage.setItem("liprep_saved_status", solvedStatus);
  }, [solvedStatus]);

  useEffect(() => {
    localStorage.setItem("liprep_saved_exclude_bb", JSON.stringify(excludeBluebook));
  }, [excludeBluebook]);

  useEffect(() => {
    localStorage.setItem("liprep_saved_topics", JSON.stringify(Array.from(selected)));
  }, [selected]);

  useEffect(() => {
    if (isStatsModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isStatsModalOpen]);

  const refreshUserData = useCallback(async () => {
    const freshStats = await getUserStatistics();
    const freshHeatmap = await getActivityHeatmapData();
    setStats(freshStats);
    setActivityData(freshHeatmap);
  }, []);

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  function toggleDifficultyTier(numbers: number[]) {
    const next = new Set(difficulty);
    const allOn = numbers.every((n) => next.has(n));
    numbers.forEach((n) => {
      if (allOn) next.delete(n);
      else next.add(n);
    });
    setDifficulty(next);
  }

  function toggleSingleDifficulty(num: number) {
    const next = new Set(difficulty);
    if (next.has(num)) next.delete(num);
    else next.add(num);
    setDifficulty(next);
  }

  function handleStartPractice() {
    const subtopics = Array.from(selected).map((title) => topicCodes[title]).filter(Boolean);
    const difficultyLevels = Array.from(difficulty);

    const filterPayload = {
      subtopics,
      difficultyLevels,
      solvedStatus,
      excludeBluebook,
    };

    sessionStorage.setItem("filters", JSON.stringify(filterPayload));
    navigate("/practice");
  }

  const formatPrepTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${secs}s`;
  };

  const handleDrillSkill = (skillCode: string) => {
    const filterPayload = {
      subtopics: [skillCode],
      difficultyLevels: Array.from(difficulty),
      solvedStatus,
      excludeBluebook,
    };
    sessionStorage.setItem("filters", JSON.stringify(filterPayload));
    navigate("/practice");
  };

  return (
    <div className="filter-page animate-fade-in">
      <header className="filter-header">
        <div>
          <h1 className="greeting-title">
            {greeting.main}
            <span className="greeting-subtitle">{greeting.sub}</span>
          </h1>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Link to="/" className="retro-btn" style={{ padding: "8px 16px", fontSize: "0.9rem" }}>
            ← Home
          </Link>
          <button
            type="button"
            className="retro-btn retro-btn-primary"
            onClick={() => setIsStatsModalOpen(true)}
            style={{ padding: "8px 16px", fontSize: "0.9rem" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            <span>Analytics & Progress</span>
          </button>
        </div>
      </header>

      <div className="filter-main-layout">
        <aside className="dashboard-sidebar-right filter-controls-pane">
          <div className="retro-card filter-control-card">
            <h3 className="filter-section-title">Status Filter</h3>
            
            <div className="status-grid-matrix">
              <button
                type="button"
                className={`matrix-status-btn ${solvedStatus === "all" ? "active" : ""}`}
                onClick={() => setSolvedStatus("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`matrix-status-btn ${solvedStatus === "unsolved" ? "active" : ""}`}
                onClick={() => setSolvedStatus("unsolved")}
              >
                Unsolved
              </button>
              <button
                type="button"
                className={`matrix-status-btn ${solvedStatus === "incorrect" ? "active" : ""}`}
                onClick={() => setSolvedStatus("incorrect")}
              >
                Mistakes
              </button>
              <button
                type="button"
                className={`matrix-status-btn ${solvedStatus === "bookmarked" ? "active" : ""}`}
                onClick={() => setSolvedStatus("bookmarked")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>Bookmarks</span>
              </button>
            </div>

            <label className="bluebook-exclude-toggle">
              <input
                type="checkbox"
                checked={excludeBluebook}
                onChange={(e) => setExcludeBluebook(e.target.checked)}
              />
              <span>Exclude Bluebook practice questions</span>
            </label>

            <h3 className="filter-section-title" style={{ marginTop: "4px" }}>
              Difficulty (Bands 1➔7)
            </h3>
            <div className="difficulty-band-group">
              <div className="diff-tier-row">
                <label className="diff-tier-label" onClick={() => toggleDifficultyTier([1, 2, 3])}>
                  <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--color-green-dot)" }} />
                  <span>Easy (1–3)</span>
                </label>
                <div className="diff-dots-container">
                  {[1, 2, 3].map((num) => {
                    const active = difficulty.has(num);
                    return (
                      <button
                        key={num}
                        type="button"
                        className={`diff-dot-button ${active ? "is-active" : ""}`}
                        style={{
                          borderColor: "var(--color-green-dot)",
                          backgroundColor: active ? "var(--color-green-dot)" : "#FFF",
                        }}
                        onClick={() => toggleSingleDifficulty(num)}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="diff-tier-row">
                <label className="diff-tier-label" onClick={() => toggleDifficultyTier([4, 5])}>
                  <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--color-amber-dot)" }} />
                  <span>Medium (4–5)</span>
                </label>
                <div className="diff-dots-container">
                  {[4, 5].map((num) => {
                    const active = difficulty.has(num);
                    return (
                      <button
                        key={num}
                        type="button"
                        className={`diff-dot-button ${active ? "is-active" : ""}`}
                        style={{
                          borderColor: "var(--color-amber-dot)",
                          backgroundColor: active ? "var(--color-amber-dot)" : "#FFF",
                        }}
                        onClick={() => toggleSingleDifficulty(num)}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="diff-tier-row">
                <label className="diff-tier-label" onClick={() => toggleDifficultyTier([6, 7])}>
                  <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--color-coral-dot)" }} />
                  <span>Hard (6–7)</span>
                </label>
                <div className="diff-dots-container">
                  {[6, 7].map((num) => {
                    const active = difficulty.has(num);
                    return (
                      <button
                        key={num}
                        type="button"
                        className={`diff-dot-button ${active ? "is-active" : ""}`}
                        style={{
                          borderColor: "var(--color-coral-dot)",
                          backgroundColor: active ? "var(--color-coral-dot)" : "#FFF",
                        }}
                        onClick={() => toggleSingleDifficulty(num)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="retro-btn retro-btn-primary"
              style={{ marginTop: "12px", width: "100%", padding: "14px" }}
              onClick={handleStartPractice}
              disabled={selected.size === 0 || difficulty.size === 0}
            >
              Start Session →
            </button>
          </div>
        </aside>

        <main className="modules-selection-pane">
          <TopicSelection
            selected={selected}
            setSelected={setSelected}
            difficulty={difficulty}
            solvedStatus={solvedStatus}
            excludeBluebook={excludeBluebook}
          />
        </main>

        <aside className="dashboard-sidebar-left calendar-pane">
          <div className="retro-card stats-trigger-card">
            <h4 style={{ fontSize: "1.05rem", fontWeight: 800 }}>Activity Heatmap</h4>
            <MonthCalendar
              activityData={activityData}
              themeColor="var(--color-navy)"
              showMonthLabel={true}
              showWeekdayLabels={true}
              showNavButtons={true}
              showLegend={true}
              maxWidth="100%"
            />

            {stats && stats.currentStreakDays > 0 && (
              <div className="clean-streak-label">
                <svg className="streak-fire-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
                <span>{stats.currentStreakDays} day streak</span>
              </div>
            )}

            {stats && (
              <div className="today-prep-box">
                <div className="today-prep-header">Today's Progress</div>
                <div className="today-prep-details">
                  <span>EBRW: <strong>{stats.today.ebrwSolved}</strong></span>
                  <span>Math: <strong>{stats.today.mathSolved}</strong></span>
                </div>
                <div className="today-prep-timer">
                  Time: <strong>{formatPrepTime(stats.today.totalTimeSeconds)}</strong>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {isStatsModalOpen && stats && (
        <AnalyticsModal
          stats={stats}
          onClose={() => setIsStatsModalOpen(false)}
          onReset={async () => {
            await clearAllUserData();
            await refreshUserData();
          }}
          onRefreshData={refreshUserData}
          onDrillSkill={handleDrillSkill}
        />
      )}
    </div>
  );
}
