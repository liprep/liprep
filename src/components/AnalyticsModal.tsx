import { useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { UserStats } from "@/types/questions";
import { topicTree, topicCodes, domainMap } from "./TopicTree";
import { exportUserData, importUserData } from "@/db";
import "./AnalyticsModal.css";

const Icons = {
  Dashboard: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  Radar: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  ),
  PaceMatrix: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Curves: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Domains: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Warning: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Timer: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Target: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Download: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Upload: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  Trash: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
};

interface AnalyticsModalProps {
  stats: UserStats;
  onClose: () => void;
  onReset: () => Promise<void>;
  onRefreshData?: () => Promise<void>;
  onDrillSkill?: (skillCode: string) => void;
}

type TabType = "executive" | "radar" | "matrix" | "difficulty" | "domains";

export default function AnalyticsModal({
  stats,
  onClose,
  onReset,
  onRefreshData,
  onDrillSkill,
}: AnalyticsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("executive");
  const [scoreBandModule, setScoreBandModule] = useState<"all" | "reading" | "math">("all");
  const [hierarchyModuleFilter, setHierarchyModuleFilter] = useState<"all" | "reading" | "math">("all");
  const [hierarchySearchQuery, setHierarchySearchQuery] = useState("");
  const [hoveredRadarIndex, setHoveredRadarIndex] = useState<number | null>(null);
  const [hoveredMatrixSkill, setHoveredMatrixSkill] = useState<{
    name: string;
    module: string;
    acc: number;
    time: number;
    attempts: number;
    x: number;
    y: number;
  } | null>(null);

  // Collapsible Bottom Progress Drawer State
  const [isFooterDrawerExpanded, setIsFooterDrawerExpanded] = useState(false);

  // Manual multi-click progression state
  const [resetClickCount, setResetClickCount] = useState<number>(0);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Import / Export Feedback States
  const [actionFeedback, setActionFeedback] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const radarDomains: Array<{ code: string; label: string; module: "reading" | "math" }> = [
    { code: "CAS", label: "Craft & Struct", module: "reading" },
    { code: "EOI", label: "Expr of Ideas", module: "reading" },
    { code: "INI", label: "Info & Ideas", module: "reading" },
    { code: "SEC", label: "Std English", module: "reading" },
    { code: "H", label: "Algebra", module: "math" },
    { code: "P", label: "Adv Math", module: "math" },
    { code: "Q", label: "Data & Problem", module: "math" },
    { code: "S", label: "Geom & Trig", module: "math" },
  ];

  const radarCenter = { x: 200, y: 175 };
  const radarRadius = 125;
  const totalAxes = radarDomains.length;

  const getCoordinatesForAxis = (axisIndex: number, valueRatio: number) => {
    const angle = (Math.PI * 2 / totalAxes) * axisIndex - Math.PI / 2;
    const r = radarRadius * Math.max(0, Math.min(1, valueRatio));
    return {
      x: radarCenter.x + r * Math.cos(angle),
      y: radarCenter.y + r * Math.sin(angle),
    };
  };

  const firstTryPolygonPoints = radarDomains
    .map((dom, i) => {
      const data = stats.domainStats[dom.code];
      const ratio = data && data.uniqueQuestions > 0 ? data.firstTryAccuracyPct / 100 : 0.05;
      const coords = getCoordinatesForAxis(i, ratio);
      return `${coords.x},${coords.y}`;
    })
    .join(" ");

  const overallPolygonPoints = radarDomains
    .map((dom, i) => {
      const data = stats.domainStats[dom.code];
      const ratio = data && data.totalAttempts > 0 ? data.overallAccuracyPct / 100 : 0.05;
      const coords = getCoordinatesForAxis(i, ratio);
      return `${coords.x},${coords.y}`;
    })
    .join(" ");

  const matrixSkills = useMemo(() => {
    const skills = [...stats.weakestSkills, ...stats.strongestSkills];
    const uniqueMap = new Map<string, (typeof skills)[0]>();
    skills.forEach((s) => uniqueMap.set(s.code, s));
    return Array.from(uniqueMap.values());
  }, [stats.weakestSkills, stats.strongestSkills]);

  const activeDifficultyStats = useMemo(() => {
    if (scoreBandModule === "reading") return stats.ebrw.difficultyStats;
    if (scoreBandModule === "math") return stats.math.difficultyStats;
    return stats.difficultyStats;
  }, [scoreBandModule, stats]);

  const formatPrepTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}m ${secs}s`;
  };

  const domainHierarchy = useMemo(() => {
    const list: Array<{
      groupName: string;
      code: string;
      module: "reading" | "math";
      skills: Array<{ name: string; code: string }>;
    }> = [];

    Object.entries(topicTree.reading).forEach(([groupName, childTopicNames]) => {
      const domainCode = Object.keys(domainMap).find((k) => domainMap[k] === groupName) || "CAS";
      list.push({
        groupName,
        code: domainCode,
        module: "reading",
        skills: childTopicNames.map((name) => ({ name, code: topicCodes[name] || name })),
      });
    });

    Object.entries(topicTree.math).forEach(([groupName, childTopicNames]) => {
      const domainCode = Object.keys(domainMap).find((k) => domainMap[k] === groupName) || "H";
      list.push({
        groupName,
        code: domainCode,
        module: "math",
        skills: childTopicNames.map((name) => ({ name, code: topicCodes[name] || name })),
      });
    });

    return list;
  }, []);

  const filteredDomainHierarchy = useMemo(() => {
    const query = hierarchySearchQuery.trim().toLowerCase();
    return domainHierarchy
      .filter((dom) => hierarchyModuleFilter === "all" || dom.module === hierarchyModuleFilter)
      .map((dom) => {
        if (!query) return dom;
        const matchingSkills = dom.skills.filter(
          (sk) => sk.name.toLowerCase().includes(query) || sk.code.toLowerCase().includes(query)
        );
        const matchesDomain = dom.groupName.toLowerCase().includes(query);
        if (matchesDomain) return dom;
        if (matchingSkills.length > 0) {
          return { ...dom, skills: matchingSkills };
        }
        return null;
      })
      .filter((dom): dom is NonNullable<typeof dom> => dom !== null);
  }, [domainHierarchy, hierarchyModuleFilter, hierarchySearchQuery]);

  async function handleExport() {
    try {
      const fileName = await exportUserData();
      setActionFeedback({ msg: `Successfully exported ${fileName}.`, type: "success" });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: unknown) {
      setActionFeedback({ msg: err instanceof Error ? err.message : "Export failed.", type: "error" });
      setTimeout(() => setActionFeedback(null), 3000);
    }
  }

  async function handleImportFile(file: File) {
    try {
      const res = await importUserData(file);
      if (onRefreshData) await onRefreshData();
      setActionFeedback({
        msg: `Imported ${res.attemptsCount} attempts & ${res.bookmarksCount} bookmarks.`,
        type: "success",
      });
      setTimeout(() => setActionFeedback(null), 3500);
    } catch (err: unknown) {
      setActionFeedback({ msg: err instanceof Error ? err.message : "Import failed.", type: "error" });
      setTimeout(() => setActionFeedback(null), 3500);
    }
  }

  function handleResetButtonClick() {
    if (resetClickCount === 0) {
      setResetClickCount(1);
    } else if (resetClickCount === 1) {
      setResetClickCount(2);
    } else if (resetClickCount === 2) {
      setResetClickCount(0);
      setIsResetConfirmOpen(true);
    }
  }

  return createPortal(
    <div className="analytics-overlay animate-fade-in" onClick={onClose}>
      <div className="analytics-modal-shell animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <header className="analytics-top-header">
          <div className="analytics-header-left">
            <div className="analytics-badge-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div>
              <h2 className="analytics-title-main">Analytics & Progress</h2>
              <p className="analytics-subtitle">
                Comprehensive question-level telemetry, pacing, and domain mastery
              </p>
            </div>
          </div>

          <div className="analytics-tabs-track">
            <button
              type="button"
              className={`analytics-tab-btn ${activeTab === "executive" ? "active" : ""}`}
              onClick={() => setActiveTab("executive")}
            >
              <Icons.Dashboard /> <span>Overview</span>
            </button>
            <button
              type="button"
              className={`analytics-tab-btn ${activeTab === "radar" ? "active" : ""}`}
              onClick={() => setActiveTab("radar")}
            >
              <Icons.Radar /> <span>Radar Web</span>
            </button>
            <button
              type="button"
              className={`analytics-tab-btn ${activeTab === "matrix" ? "active" : ""}`}
              onClick={() => setActiveTab("matrix")}
            >
              <Icons.PaceMatrix /> <span>Pace Matrix</span>
            </button>
            <button
              type="button"
              className={`analytics-tab-btn ${activeTab === "difficulty" ? "active" : ""}`}
              onClick={() => setActiveTab("difficulty")}
            >
              <Icons.Curves /> <span>Score Bands</span>
            </button>
            <button
              type="button"
              className={`analytics-tab-btn ${activeTab === "domains" ? "active" : ""}`}
              onClick={() => setActiveTab("domains")}
            >
              <Icons.Domains /> <span>All Domains & Skills</span>
            </button>
          </div>

          <button
            type="button"
            className="analytics-close-btn"
            onClick={onClose}
            aria-label="Close analytics modal"
          >
            ✕
          </button>
        </header>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className={`action-feedback-toast ${actionFeedback.type}`}>
            {actionFeedback.msg}
          </div>
        )}

        {/* Modal Scroll Body */}
        <div className="analytics-body-scroll">
          {/* TAB 1: EXECUTIVE OVERVIEW */}
          {activeTab === "executive" && (
            <>
              {/* Executive KPI Banner - only displayed in Overview */}
              <div className="executive-kpi-banner">
                <div className="kpi-stat-card">
                  <div className="kpi-header-row">
                    <div className="kpi-label-cluster">
                      <Icons.Check />
                      <span className="kpi-label">First-Try Accuracy</span>
                    </div>
                    <span className="kpi-pill-badge" style={{ background: "#EEF2FF", color: "#4338CA" }}>
                      {stats.firstTryOverallAccuracyPct}%
                    </span>
                  </div>
                  <div className="kpi-val-row">
                    <span className="kpi-value-huge">{stats.firstTryOverallAccuracyPct}%</span>
                  </div>
                  <div className="kpi-subtext">
                    {stats.uniqueQuestionsAttempted} unique questions solved
                  </div>
                </div>

                <div className="kpi-stat-card kpi-highlight-ebrw">
                  <div className="kpi-header-row">
                    <div className="kpi-label-cluster">
                      <Icons.Target />
                      <span className="kpi-label" style={{ color: "#525FE1" }}>
                        EBRW Section
                      </span>
                    </div>
                    <span className="kpi-pill-badge" style={{ background: "#EEF2FF", color: "#4338CA" }}>
                      {stats.ebrw.firstTryAccuracyPct}%
                    </span>
                  </div>
                  <div className="kpi-val-row">
                    <span className="kpi-value-huge" style={{ color: "#525FE1" }}>
                      {stats.ebrw.uniqueAttempted}
                    </span>
                    <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#94A3B8" }}>solved</span>
                  </div>
                  <div className="kpi-subtext">
                    ~{stats.ebrw.avgTimeSeconds}s avg pace • {formatPrepTime(stats.ebrw.totalTimeSeconds)} total
                  </div>
                </div>

                <div className="kpi-stat-card kpi-highlight-math">
                  <div className="kpi-header-row">
                    <div className="kpi-label-cluster">
                      <Icons.Target />
                      <span className="kpi-label" style={{ color: "#FF9955" }}>
                        Math Section
                      </span>
                    </div>
                    <span className="kpi-pill-badge" style={{ background: "#FFF7ED", color: "#C2410C" }}>
                      {stats.math.firstTryAccuracyPct}%
                    </span>
                  </div>
                  <div className="kpi-val-row">
                    <span className="kpi-value-huge" style={{ color: "#FF9955" }}>
                      {stats.math.uniqueAttempted}
                    </span>
                    <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#94A3B8" }}>solved</span>
                  </div>
                  <div className="kpi-subtext">
                    ~{stats.math.avgTimeSeconds}s avg pace • {formatPrepTime(stats.math.totalTimeSeconds)} total
                  </div>
                </div>

                <div className="kpi-stat-card">
                  <div className="kpi-header-row">
                    <div className="kpi-label-cluster">
                      <Icons.Timer />
                      <span className="kpi-label">Upsolve Velocity</span>
                    </div>
                    <span className="kpi-pill-badge" style={{ background: "#DCFCE7", color: "#166534" }}>
                      {stats.totalUpsolvedCount} corrected
                    </span>
                  </div>
                  <div className="kpi-val-row">
                    <span className="kpi-value-huge" style={{ color: "#166534" }}>
                      {stats.uniqueCorrect}
                    </span>
                    <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#94A3B8" }}>
                      / {stats.uniqueQuestionsAttempted}
                    </span>
                  </div>
                  <div className="kpi-subtext">
                    {stats.uniqueIncorrect} currently unsolved mistakes
                  </div>
                </div>
              </div>

              <div className="dual-chart-row">
                <div className="chart-panel-card">
                  <div className="chart-panel-header">
                    <div className="chart-title-cluster">
                      <h3>Section Mastery & Timing Telemetry</h3>
                      <p>Direct comparison between Reading & Writing vs. Math performance</p>
                    </div>
                  </div>

                  <div className="module-comparison-grid">
                    <div className="module-telemetry-box box-ebrw">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 800, color: "#525FE1", fontSize: "0.95rem" }}>
                          Reading & Writing
                        </span>
                        <span className="action-module-tag tag-ebrw">EBRW</span>
                      </div>
                      <div className="telemetry-row">
                        <span className="telemetry-label">1st-Try Accuracy:</span>
                        <span className="telemetry-val">{stats.ebrw.firstTryAccuracyPct}%</span>
                      </div>
                      <div className="telemetry-row">
                        <span className="telemetry-label">Overall Attempt Acc:</span>
                        <span className="telemetry-val">{stats.ebrw.overallAccuracyPct}%</span>
                      </div>
                      <div className="telemetry-row">
                        <span className="telemetry-label">Average Pace:</span>
                        <span className="telemetry-val">{stats.ebrw.avgTimeSeconds}s / question</span>
                      </div>
                      <div className="telemetry-row">
                        <span className="telemetry-label">Upsolved Mistakes:</span>
                        <span className="telemetry-val">{stats.ebrw.upsolvedCount}</span>
                      </div>
                    </div>

                    <div className="module-telemetry-box box-math">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 800, color: "#FF9955", fontSize: "0.95rem" }}>
                          Math
                        </span>
                        <span className="action-module-tag tag-math">MATH</span>
                      </div>
                      <div className="telemetry-row">
                        <span className="telemetry-label">1st-Try Accuracy:</span>
                        <span className="telemetry-val">{stats.math.firstTryAccuracyPct}%</span>
                      </div>
                      <div className="telemetry-row">
                        <span className="telemetry-label">Overall Attempt Acc:</span>
                        <span className="telemetry-val">{stats.math.overallAccuracyPct}%</span>
                      </div>
                      <div className="telemetry-row">
                        <span className="telemetry-label">Average Pace:</span>
                        <span className="telemetry-val">{stats.math.avgTimeSeconds}s / question</span>
                      </div>
                      <div className="telemetry-row">
                        <span className="telemetry-label">Upsolved Mistakes:</span>
                        <span className="telemetry-val">{stats.math.upsolvedCount}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="chart-panel-card">
                  <div className="chart-panel-header">
                    <div className="chart-title-cluster">
                      <h3>Mastery Status Flow</h3>
                      <p>First-try solves vs. upsolved retries</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: "16px" }}>
                    <svg width="145" height="145" viewBox="0 0 160 160">
                      <circle cx="80" cy="80" r="62" fill="none" stroke="#F1F5F9" strokeWidth="18" />

                      <circle
                        cx="80"
                        cy="80"
                        r="62"
                        fill="none"
                        stroke="#22C55E"
                        strokeWidth="18"
                        strokeDasharray={`${
                          stats.uniqueQuestionsAttempted > 0
                            ? ((stats.uniqueCorrect - stats.totalUpsolvedCount) / stats.uniqueQuestionsAttempted) * 389.5
                            : 0
                        } 389.5`}
                        strokeDashoffset="0"
                        transform="rotate(-90 80 80)"
                      />

                      <circle
                        cx="80"
                        cy="80"
                        r="62"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="18"
                        strokeDasharray={`${
                          stats.uniqueQuestionsAttempted > 0
                            ? (stats.totalUpsolvedCount / stats.uniqueQuestionsAttempted) * 389.5
                            : 0
                        } 389.5`}
                        strokeDashoffset={`-${
                          stats.uniqueQuestionsAttempted > 0
                            ? ((stats.uniqueCorrect - stats.totalUpsolvedCount) / stats.uniqueQuestionsAttempted) * 389.5
                            : 0
                        }`}
                        transform="rotate(-90 80 80)"
                      />

                      <circle
                        cx="80"
                        cy="80"
                        r="62"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="18"
                        strokeDasharray={`${
                          stats.uniqueQuestionsAttempted > 0
                            ? (stats.uniqueIncorrect / stats.uniqueQuestionsAttempted) * 389.5
                            : 0
                        } 389.5`}
                        strokeDashoffset={`-${
                          stats.uniqueQuestionsAttempted > 0
                            ? (stats.uniqueCorrect / stats.uniqueQuestionsAttempted) * 389.5
                            : 0
                        }`}
                        transform="rotate(-90 80 80)"
                      />

                      <text x="80" y="76" textAnchor="middle" fill="#10375C" fontSize="19" fontWeight="900">
                        {stats.uniqueQuestionsAttempted}
                      </text>
                      <text x="80" y="93" textAnchor="middle" fill="#64748B" fontSize="9" fontWeight="700">
                        SOLVED
                      </text>
                    </svg>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#22C55E" }} />
                          <strong>1st-Try Correct:</strong>
                        </span>
                        <span style={{ fontWeight: 800 }}>{stats.uniqueCorrect - stats.totalUpsolvedCount}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#F59E0B" }} />
                          <strong>Upsolved:</strong>
                        </span>
                        <span style={{ fontWeight: 800 }}>{stats.totalUpsolvedCount}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#EF4444" }} />
                          <strong>Unsolved:</strong>
                        </span>
                        <span style={{ fontWeight: 800 }}>{stats.uniqueIncorrect}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {stats.weakestSkills.length > 0 && (
                <div className="chart-panel-card">
                  <div className="chart-panel-header">
                    <div className="chart-title-cluster">
                      <h3 style={{ color: "var(--color-coral-text)" }}>
                        <Icons.Warning /> Targeted Reinforcement Areas
                      </h3>
                      <p>Skills with highest error frequency requiring targeted practice</p>
                    </div>
                  </div>

                  <div className="action-priority-list">
                    {stats.weakestSkills.map((sk) => (
                      <div key={sk.code} className="action-priority-item high-danger">
                        <div className="action-item-left">
                          <span className={`action-module-tag ${sk.module === "math" ? "tag-math" : "tag-ebrw"}`}>
                            {sk.module}
                          </span>
                          <span className="action-skill-name" title={sk.name}>
                            {sk.name}
                          </span>
                        </div>
                        <div className="action-item-right">
                          <span className="action-item-meta">
                            {sk.attempted} attempts • ~{sk.avgTime}s/q
                          </span>
                          <span className="action-acc-badge">{sk.accuracyPct}%</span>
                          {onDrillSkill && (
                            <button
                              type="button"
                              className="action-drill-btn"
                              onClick={() => {
                                onDrillSkill(sk.code);
                                onClose();
                              }}
                            >
                              Practice Drill →
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* TAB 2: 8-AXIS RADAR SPECTRUM */}
          {activeTab === "radar" && (
            <div className="dual-chart-row">
              <div className="chart-panel-card">
                <div className="chart-panel-header">
                  <div className="chart-title-cluster">
                    <h3>8-Domain Radar Equilibrium</h3>
                    <p>Simultaneous balance across EBRW & Math competencies</p>
                  </div>
                  <div className="chart-legend-row">
                    <span className="legend-dot-item">
                      <span className="legend-swatch" style={{ background: "#525FE1" }} />
                      1st-Try Acc
                    </span>
                    <span className="legend-dot-item">
                      <span className="legend-swatch" style={{ background: "#FF9955" }} />
                      Overall Acc
                    </span>
                  </div>
                </div>

                <svg viewBox="0 0 400 350" className="svg-interactive-canvas">
                  {[0.25, 0.5, 0.75, 1.0].map((level) => {
                    const pts = radarDomains
                      .map((_, i) => {
                        const coords = getCoordinatesForAxis(i, level);
                        return `${coords.x},${coords.y}`;
                      })
                      .join(" ");
                    return (
                      <polygon
                        key={level}
                        points={pts}
                        fill="none"
                        stroke="#E2E8F0"
                        strokeWidth="1.2"
                      />
                    );
                  })}

                  {radarDomains.map((_, i) => {
                    const edge = getCoordinatesForAxis(i, 1.0);
                    return (
                      <line
                        key={i}
                        x1={radarCenter.x}
                        y1={radarCenter.y}
                        x2={edge.x}
                        y2={edge.y}
                        stroke="#CBD5E1"
                        strokeWidth="1.2"
                      />
                    );
                  })}

                  <polygon points={overallPolygonPoints} className="radar-polygon-overall" />
                  <polygon points={firstTryPolygonPoints} className="radar-polygon-first" />

                  {radarDomains.map((dom, i) => {
                    const data = stats.domainStats[dom.code];
                    const ratio = data && data.uniqueQuestions > 0 ? data.firstTryAccuracyPct / 100 : 0.05;
                    const coords = getCoordinatesForAxis(i, ratio);
                    const labelPos = getCoordinatesForAxis(i, 1.2);

                    return (
                      <g key={dom.code}>
                        <circle
                          cx={coords.x}
                          cy={coords.y}
                          r="4.5"
                          className="radar-vertex-node"
                          onMouseEnter={() => setHoveredRadarIndex(i)}
                          onMouseLeave={() => setHoveredRadarIndex(null)}
                        />
                        <text
                          x={labelPos.x}
                          y={labelPos.y + (labelPos.y > radarCenter.y ? 4 : -2)}
                          textAnchor={
                            labelPos.x < radarCenter.x - 20
                              ? "end"
                              : labelPos.x > radarCenter.x + 20
                              ? "start"
                              : "middle"
                          }
                          fontSize="9.5"
                          fontWeight="800"
                          fill={dom.module === "reading" ? "#525FE1" : "#FF9955"}
                        >
                          {dom.label}
                        </text>
                      </g>
                    );
                  })}

                  {hoveredRadarIndex !== null && (
                    <g className="svg-tooltip-box">
                      <rect
                        x="130"
                        y="150"
                        width="140"
                        height="50"
                        rx="8"
                        fill="#10375C"
                      />
                      <text x="200" y="168" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="800">
                        {radarDomains[hoveredRadarIndex].label}
                      </text>
                      <text x="200" y="186" textAnchor="middle" fill="#F3C623" fontSize="11" fontWeight="900">
                        1st: {stats.domainStats[radarDomains[hoveredRadarIndex].code]?.firstTryAccuracyPct || 0}% | Overall: {stats.domainStats[radarDomains[hoveredRadarIndex].code]?.overallAccuracyPct || 0}%
                      </text>
                    </g>
                  )}
                </svg>
              </div>

              <div className="chart-panel-card radar-summary-card">
                <div className="chart-panel-header">
                  <div className="chart-title-cluster">
                    <h3>Domain Index Summary</h3>
                    <p>Breakdown by module and mastery volume</p>
                  </div>
                </div>

                <div className="domain-summary-scroll-list">
                  {radarDomains.map((dom) => {
                    const data = stats.domainStats[dom.code] || {
                      name: dom.label,
                      firstTryAccuracyPct: 0,
                      overallAccuracyPct: 0,
                      uniqueQuestions: 0,
                      avgTimeSeconds: 0,
                    };

                    return (
                      <div key={dom.code} className="domain-summary-card-item">
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--color-navy)" }}>
                            {domainMap[dom.code] || dom.label}
                          </span>
                          <span style={{ fontSize: "0.85rem", fontWeight: 800, color: dom.module === "reading" ? "#525FE1" : "#FF9955" }}>
                            {data.firstTryAccuracyPct}%
                          </span>
                        </div>
                        <div className="domain-progress-track">
                          <div
                            className="domain-progress-fill"
                            style={{
                              width: `${data.firstTryAccuracyPct}%`,
                              backgroundColor: dom.module === "reading" ? "#525FE1" : "#FF9955",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "0.74rem", color: "#64748B" }}>
                          <span>{data.uniqueQuestions} unique questions</span>
                          <span>~{data.avgTimeSeconds}s / question</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SPEED VS ACCURACY QUADRANT MATRIX */}
          {activeTab === "matrix" && (
            <div className="chart-panel-card">
              <div className="chart-panel-header">
                <div className="chart-title-cluster">
                  <h3>Pacing vs. Accuracy Diagnostic Matrix</h3>
                  <p>Categorizing every skill into behavioral performance quadrants</p>
                </div>
                <div className="chart-legend-row">
                  <span className="legend-dot-item">
                    <span className="legend-swatch" style={{ background: "#525FE1" }} />
                    EBRW Skill
                  </span>
                  <span className="legend-dot-item">
                    <span className="legend-swatch" style={{ background: "#FF9955" }} />
                    Math Skill
                  </span>
                </div>
              </div>

              <div style={{ position: "relative" }}>
                <svg viewBox="0 0 700 360" className="svg-interactive-canvas">
                  <rect x="50" y="20" width="300" height="150" fill="#F0FDF4" opacity="0.6" />
                  <text x="60" y="40" fill="#166534" fontSize="11" fontWeight="800">
                    OPTIMAL PACE & ACCURACY (Fast & Accurate)
                  </text>

                  <rect x="350" y="20" width="300" height="150" fill="#FEF3C7" opacity="0.5" />
                  <text x="360" y="40" fill="#B45309" fontSize="11" fontWeight="800">
                    ACCURATE · SLOW PACING (Needs Speed Drill)
                  </text>

                  <rect x="50" y="170" width="300" height="150" fill="#FFF7ED" opacity="0.6" />
                  <text x="60" y="305" fill="#C2410C" fontSize="11" fontWeight="800">
                    HIGH PACE · FREQUENT MISTAKES (Rushing)
                  </text>

                  <rect x="350" y="170" width="300" height="150" fill="#FEF2F2" opacity="0.6" />
                  <text x="360" y="305" fill="#991B1B" fontSize="11" fontWeight="800">
                    NEEDS REINFORCEMENT (Slow & Inaccurate)
                  </text>

                  <line x1="50" y1="170" x2="650" y2="170" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 4" />
                  <line x1="350" y1="20" x2="350" y2="320" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 4" />
                  <rect x="50" y="20" width="600" height="300" fill="none" stroke="#CBD5E1" strokeWidth="2" />

                  {matrixSkills.map((sk) => {
                    const minTime = 15;
                    const maxTime = 130;
                    const clampedTime = Math.max(minTime, Math.min(maxTime, sk.avgTime));
                    const x = 50 + ((clampedTime - minTime) / (maxTime - minTime)) * 600;
                    const y = 320 - (sk.accuracyPct / 100) * 300;
                    const isMath = sk.module === "math";
                    const isHovered = hoveredMatrixSkill?.name === sk.name;

                    return (
                      <g
                        key={sk.code}
                        onMouseEnter={() =>
                          setHoveredMatrixSkill({
                            name: sk.name,
                            module: sk.module,
                            acc: sk.accuracyPct,
                            time: sk.avgTime,
                            attempts: sk.attempted,
                            x,
                            y,
                          })
                        }
                        onMouseLeave={() => setHoveredMatrixSkill(null)}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={Math.max(6, Math.min(14, 5 + sk.attempted * 1.5))}
                          fill={isMath ? "#FF9955" : "#525FE1"}
                          stroke={isHovered ? "var(--color-gold)" : "#10375C"}
                          strokeWidth={isHovered ? 3.5 : 2}
                          className="quad-point-node"
                        />
                      </g>
                    );
                  })}

                  <text x="50" y="340" fill="#64748B" fontSize="10" fontWeight="700">← Faster Pace (15s)</text>
                  <text x="650" y="340" textAnchor="end" fill="#64748B" fontSize="10" fontWeight="700">Slower Pace (130s) →</text>
                  <text x="40" y="28" textAnchor="end" fill="#64748B" fontSize="10" fontWeight="700">100%</text>
                  <text x="40" y="174" textAnchor="end" fill="#64748B" fontSize="10" fontWeight="700">50%</text>
                  <text x="40" y="324" textAnchor="end" fill="#64748B" fontSize="10" fontWeight="700">0%</text>
                </svg>

                {hoveredMatrixSkill && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${(hoveredMatrixSkill.x / 700) * 100}%`,
                      top: `${(hoveredMatrixSkill.y / 360) * 100}%`,
                      transform: "translate(-50%, -120%)",
                      background: "#10375C",
                      color: "#FFFFFF",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      pointerEvents: "none",
                      boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
                      whiteSpace: "nowrap",
                      zIndex: 20,
                    }}
                  >
                    <div>{hoveredMatrixSkill.name}</div>
                    <div style={{ color: "#F3C623", fontSize: "0.75rem", marginTop: "2px" }}>
                      {hoveredMatrixSkill.acc}% accuracy • {hoveredMatrixSkill.time}s avg pace • {hoveredMatrixSkill.attempts} attempts
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: DIFFICULTY & SCORE BAND DUAL CHARTS */}
          {activeTab === "difficulty" && (
            <div className="chart-panel-card">
              <div className="chart-panel-header">
                <div className="chart-title-cluster">
                  <h3>Score Bands 1 → 7 Dual Pacing & Accuracy Curve</h3>
                  <p>Accuracy rate bars overlaid with average time-per-question spline</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <div className="hierarchy-module-filter-pills">
                    <button
                      type="button"
                      className={`hierarchy-filter-pill-btn ${scoreBandModule === "all" ? "active" : ""}`}
                      onClick={() => setScoreBandModule("all")}
                    >
                      All Sections
                    </button>
                    <button
                      type="button"
                      className={`hierarchy-filter-pill-btn ${scoreBandModule === "reading" ? "active" : ""}`}
                      onClick={() => setScoreBandModule("reading")}
                    >
                      EBRW
                    </button>
                    <button
                      type="button"
                      className={`hierarchy-filter-pill-btn ${scoreBandModule === "math" ? "active" : ""}`}
                      onClick={() => setScoreBandModule("math")}
                    >
                      Math
                    </button>
                  </div>
                  <div className="chart-legend-row">
                    <span className="legend-dot-item">
                      <span
                        className="legend-swatch"
                        style={{
                          background:
                            scoreBandModule === "reading"
                              ? "#525FE1"
                              : scoreBandModule === "math"
                              ? "#FF9955"
                              : "var(--color-navy)",
                        }}
                      />
                      Accuracy (%)
                    </span>
                    <span className="legend-dot-item">
                      <span className="legend-swatch" style={{ background: "#FF9955" }} />
                      Pace (Seconds)
                    </span>
                  </div>
                </div>
              </div>

              <svg viewBox="0 0 700 240" className="svg-interactive-canvas">
                <line x1="50" y1="190" x2="660" y2="190" stroke="#CBD5E1" strokeWidth="1.5" />
                <line x1="50" y1="110" x2="660" y2="110" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />
                <line x1="50" y1="30" x2="660" y2="30" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="3 3" />

                {[1, 2, 3, 4, 5, 6, 7].map((band, idx) => {
                  const data = activeDifficultyStats[band] || { accuracyPct: 0, avgTimeSeconds: 0, attempted: 0 };
                  const x = 70 + idx * 82;
                  const barHeight = (data.accuracyPct / 100) * 160;
                  const y = 190 - barHeight;
                  const barColor =
                    scoreBandModule === "reading"
                      ? "#525FE1"
                      : scoreBandModule === "math"
                      ? "#FF9955"
                      : "var(--color-navy)";

                  return (
                    <g key={band}>
                      <rect
                        x={x}
                        y={y}
                        width="46"
                        height={barHeight}
                        rx="6"
                        fill={barColor}
                        opacity={data.attempted > 0 ? "0.9" : "0.15"}
                      />
                      <text x={x + 23} y="206" textAnchor="middle" fill="#10375C" fontSize="11" fontWeight="800">
                        Band {band}
                      </text>
                      <text x={x + 23} y="220" textAnchor="middle" fill="#64748B" fontSize="9" fontWeight="600">
                        {data.attempted > 0 ? `${data.accuracyPct}%` : "—"}
                      </text>
                    </g>
                  );
                })}

                {(() => {
                  const splinePoints = [1, 2, 3, 4, 5, 6, 7].map((band, idx) => {
                    const data = activeDifficultyStats[band] || { avgTimeSeconds: 0, attempted: 0 };
                    const x = 70 + idx * 82 + 23;
                    const maxTime = 140;
                    const clamped = Math.min(maxTime, data.avgTimeSeconds);
                    const y = 190 - (clamped / maxTime) * 160;
                    return { x, y, time: data.avgTimeSeconds, hasData: data.attempted > 0 };
                  });

                  const pathD = splinePoints.reduce((acc, pt, i, arr) => {
                    if (i === 0) return `M ${pt.x} ${pt.y}`;
                    const prev = arr[i - 1];
                    const cx1 = prev.x + (pt.x - prev.x) / 2;
                    const cx2 = prev.x + (pt.x - prev.x) / 2;
                    return `${acc} C ${cx1} ${prev.y}, ${cx2} ${pt.y}, ${pt.x} ${pt.y}`;
                  }, "");

                  return (
                    <g>
                      <path d={pathD} className="spline-pacing-line" />
                      {splinePoints.map((pt, i) => (
                        <g key={i}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r="5"
                            fill="#FF9955"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                          />
                          {pt.hasData && (
                            <text
                              x={pt.x}
                              y={pt.y - 9}
                              textAnchor="middle"
                              fill="#C2410C"
                              fontSize="9.5"
                              fontWeight="800"
                            >
                              {pt.time}s
                            </text>
                          )}
                        </g>
                      ))}
                    </g>
                  );
                })()}

                <text x="40" y="34" textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="700">100%</text>
                <text x="40" y="114" textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="700">50%</text>
                <text x="40" y="194" textAnchor="end" fill="#94A3B8" fontSize="9" fontWeight="700">0%</text>
              </svg>
            </div>
          )}

          {/* TAB 5: COMPREHENSIVE DOMAINS & SKILLS BREAKDOWN */}
          {activeTab === "domains" && (
            <div className="chart-panel-card">
              <div className="chart-panel-header">
                <div className="chart-title-cluster">
                  <h3>Domain & Skill Mastery Hierarchy</h3>
                  <p>In-depth accuracy, volume, and pacing breakdown across all 8 domains</p>
                </div>
              </div>

              <div className="hierarchy-filter-toolbar">
                <div className="hierarchy-module-filter-pills">
                  <button
                    type="button"
                    className={`hierarchy-filter-pill-btn ${hierarchyModuleFilter === "all" ? "active" : ""}`}
                    onClick={() => setHierarchyModuleFilter("all")}
                  >
                    All Domains ({domainHierarchy.length})
                  </button>
                  <button
                    type="button"
                    className={`hierarchy-filter-pill-btn ${hierarchyModuleFilter === "reading" ? "active" : ""}`}
                    onClick={() => setHierarchyModuleFilter("reading")}
                  >
                    EBRW (4)
                  </button>
                  <button
                    type="button"
                    className={`hierarchy-filter-pill-btn ${hierarchyModuleFilter === "math" ? "active" : ""}`}
                    onClick={() => setHierarchyModuleFilter("math")}
                  >
                    Math (4)
                  </button>
                </div>

                <div className="hierarchy-search-box">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    className="hierarchy-search-input"
                    placeholder="Search subtopic or domain..."
                    value={hierarchySearchQuery}
                    onChange={(e) => setHierarchySearchQuery(e.target.value)}
                  />
                  {hierarchySearchQuery && (
                    <button
                      type="button"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontWeight: 800, padding: 0 }}
                      onClick={() => setHierarchySearchQuery("")}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="domain-tree-container">
                {filteredDomainHierarchy.map((dom) => {
                  const domStat = stats.domainStats[dom.code] || {
                    uniqueQuestions: 0,
                    firstTryAccuracyPct: 0,
                    overallAccuracyPct: 0,
                    avgTimeSeconds: 0,
                  };

                  const isMath = dom.module === "math";

                  return (
                    <div key={dom.code} className="domain-modern-card">
                      <div className="domain-modern-header">
                        <div className="domain-header-main">
                          <span className={`domain-badge-pill ${isMath ? "pill-math" : "pill-reading"}`}>
                            {isMath ? "Math" : "EBRW"}
                          </span>
                          <h4 className="domain-modern-title">{dom.groupName}</h4>
                        </div>

                        <div className="domain-header-telemetry">
                          <div className="domain-header-metric-pill">
                            <span>Solved:</span>
                            <strong>{domStat.uniqueQuestions} q</strong>
                          </div>
                          <div className="domain-header-metric-pill">
                            <span>1st-Try:</span>
                            <strong style={{ color: isMath ? "#C2410C" : "#4338CA" }}>
                              {domStat.firstTryAccuracyPct}%
                            </strong>
                          </div>
                          <div className="domain-header-metric-pill">
                            <span>Avg Pace:</span>
                            <strong>~{domStat.avgTimeSeconds}s</strong>
                          </div>
                        </div>
                      </div>

                      <div className="domain-skills-list">
                        {dom.skills.map((sk) => {
                          const skStat = stats.skillStats[sk.code] || {
                            firstTryAccuracyPct: 0,
                            overallAccuracyPct: 0,
                            uniqueQuestions: 0,
                            totalAttempts: 0,
                            avgTimeSeconds: 0,
                          };

                          let statusClass = "status-untested";
                          let statusLabel = "Untested";
                          if (skStat.uniqueQuestions > 0) {
                            if (skStat.firstTryAccuracyPct >= 80) {
                              statusClass = "status-mastered";
                              statusLabel = "Mastered";
                            } else if (skStat.firstTryAccuracyPct >= 50) {
                              statusClass = "status-developing";
                              statusLabel = "Developing";
                            } else {
                              statusClass = "status-needs-focus";
                              statusLabel = "Needs Focus";
                            }
                          }

                          return (
                            <div key={sk.code} className="skill-modern-row">
                              <div className="skill-info-column">
                                <div className="skill-title-cluster">
                                  <span className="skill-row-title">{sk.name}</span>
                                  <span className={`skill-mastery-status ${statusClass}`}>
                                    {statusLabel}
                                  </span>
                                </div>
                              </div>

                              <div className="skill-metrics-grid">
                                <div className="skill-metric-item metric-wide">
                                  <span className="metric-label-micro">1st-Try Accuracy</span>
                                  <div className="skill-mini-progress-bar">
                                    <span className="metric-val-medium" style={{ color: isMath ? "#C2410C" : "#4338CA", minWidth: "34px" }}>
                                      {skStat.firstTryAccuracyPct}%
                                    </span>
                                    <div className="mini-track">
                                      <div
                                        className="mini-fill"
                                        style={{
                                          width: `${skStat.firstTryAccuracyPct}%`,
                                          backgroundColor: isMath ? "#FF9955" : "#525FE1",
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="skill-metric-item">
                                  <span className="metric-label-micro">Overall Acc</span>
                                  <span className="metric-val-medium">{skStat.overallAccuracyPct}%</span>
                                </div>

                                <div className="skill-metric-item">
                                  <span className="metric-label-micro">Solved (Att)</span>
                                  <span className="metric-val-medium">
                                    {skStat.uniqueQuestions} ({skStat.totalAttempts})
                                  </span>
                                </div>

                                <div className="skill-metric-item">
                                  <span className="metric-label-micro">Avg Pace</span>
                                  <span className="metric-val-medium">~{skStat.avgTimeSeconds}s</span>
                                </div>

                                {onDrillSkill && (
                                  <button
                                    type="button"
                                    className="action-drill-btn"
                                    onClick={() => {
                                      onDrillSkill(sk.code);
                                      onClose();
                                    }}
                                  >
                                    Practice →
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Bottom Drawer */}
        <footer className={`analytics-collapsible-footer ${isFooterDrawerExpanded ? "is-expanded" : ""}`}>
          <button
            type="button"
            className="analytics-drawer-toggle-btn"
            onClick={() => setIsFooterDrawerExpanded((prev) => !prev)}
            aria-expanded={isFooterDrawerExpanded}
          >
            <div className="analytics-drawer-toggle-left">
              <span className="analytics-toggle-telemetry">
                Lifetime attempts: <strong>{stats.totalAttemptsCount}</strong>
              </span>
              <span className="analytics-toggle-dot">•</span>
              <span className="analytics-toggle-telemetry">
                Global avg pace: <strong>~{stats.avgTimeSeconds}s / question</strong>
              </span>
            </div>

            <div className="analytics-drawer-toggle-right">
              <span className="analytics-drawer-actions-label">Data & Progress Actions</span>
              <span className="analytics-drawer-chevron">{isFooterDrawerExpanded ? "▼" : "▲"}</span>
            </div>
          </button>

          {/* Drawer Body */}
          {isFooterDrawerExpanded && (
            <div className="analytics-drawer-content animate-fade-in">
              <div className="footer-actions-group">
                {/* Export Progress */}
                <button
                  type="button"
                  className="retro-btn footer-action-btn btn-export-positive"
                  onClick={handleExport}
                  title="Download your entire progress history as a .liprep backup file"
                >
                  <Icons.Download />
                  <span>Export Progress</span>
                </button>

                {/* Import Progress */}
                <label
                  className="retro-btn footer-action-btn btn-import-positive"
                  title="Restore previous progress from a .liprep file"
                >
                  <Icons.Upload />
                  <span>Import Progress</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".liprep,.json"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportFile(f);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />
                </label>

                {/* Reset Progress with manual multi-click progression */}
                <button
                  type="button"
                  className="retro-btn footer-action-btn btn-reset-danger"
                  onClick={handleResetButtonClick}
                >
                  <Icons.Trash />
                  <span>
                    {resetClickCount === 0 && "Reset Progress"}
                    {resetClickCount === 1 && "Misclick prolly"}
                    {resetClickCount === 2 && "yeah..."}
                  </span>
                </button>
              </div>
            </div>
          )}
        </footer>
      </div>

      {/* Confirmation Modal with Screen Shake */}
      {isResetConfirmOpen &&
        createPortal(
          <div
            className="full-screen-blur-overlay animate-fade-in"
            style={{ zIndex: 100000 }}
            onClick={() => {
              if (!isResetting) setIsResetConfirmOpen(false);
            }}
          >
            <div
              className="reset-sure-modal-card animate-shake"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="reset-sure-title">Are you SUREEEEE???</h3>
              <p className="reset-sure-desc">
                This will completely obliterate all your solved questions, pacing telemetry, streaks, and mistake bookmarks forever!
              </p>

              <div className="reset-sure-btn-row">
                <button
                  type="button"
                  className="retro-btn btn-take-back-orange"
                  style={{ flex: 1 }}
                  disabled={isResetting}
                  onClick={() => setIsResetConfirmOpen(false)}
                >
                  No, take me back
                </button>
                <button
                  type="button"
                  className="retro-btn btn-reset-nuke"
                  style={{ flex: 1 }}
                  disabled={isResetting}
                  onClick={async () => {
                    setIsResetting(true);
                    await onReset();
                    setIsResetting(false);
                    setIsResetConfirmOpen(false);
                    onClose();
                  }}
                >
                  {isResetting ? "Resetting..." : "Yes, Nuke Everything!"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>,
    document.body
  );
}
