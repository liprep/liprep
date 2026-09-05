import { useState, useEffect, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { parseAndIngestJSON, getStoredQuestionCount } from "@/db";
import WallOfLoveModal from "@/components/WallOfLoveModal";
import "./Home.css";

const GITHUB_STARS_CACHE_KEY = "liprep_gh_stars_cache";

export default function Home() {
  const navigate = useNavigate();
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isWallOfLoveOpen, setIsWallOfLoveOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  
  const [starCount, setStarCount] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem(GITHUB_STARS_CACHE_KEY);
      return cached ? Number(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    getStoredQuestionCount().then((count) => setQuestionCount(count));

    // Offline-safe GitHub stars fetch
    async function fetchStars() {
      try {
        const res = await fetch("https://api.github.com/repos/liprep/liprep");
        if (res.ok) {
          const data = await res.json();
          if (typeof data.stargazers_count === "number") {
            setStarCount(data.stargazers_count);
            localStorage.setItem(GITHUB_STARS_CACHE_KEY, String(data.stargazers_count));
          }
        }
      } catch {
        // Retains cached star count or graceful omission when offline
      }
    }
    fetchStars();
  }, []);

  useEffect(() => {
    if (isAboutOpen || isWallOfLoveOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isAboutOpen, isWallOfLoveOpen]);

  async function processFile(file: File) {
    if (!file.name.endsWith(".json")) {
      setUploadError("Please upload a valid .json Question Bank file.");
      return;
    }
    try {
      setIsUploading(true);
      setUploadError(null);
      const imported = await parseAndIngestJSON(file);
      setQuestionCount(imported);
      navigate("/filter");
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Error parsing JSON file.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  return (
    <div className="home-page-container animate-fade-in">
      <header className="home-top-nav">
        <div className="brand-logo-area">
          {!logoFailed ? (
            <img
              src="/liprep-logo.svg"
              alt="LiPrep"
              className="liprep-nav-img"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="brand-logo-vector">
              <span className="logo-badge">Li</span>
              <span className="logo-text">Prep</span>
            </div>
          )}
        </div>

        <div className="home-nav-actions">
          {/* Wall of Love Button */}
          <button
            type="button"
            className="retro-btn home-nav-action-btn home-wol-btn"
            onClick={() => setIsWallOfLoveOpen(true)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span className="wol-btn-text-desktop">Wall of love</span>
            <span className="wol-btn-text-mobile">love</span>
          </button>

          {/* GitHub Star Button */}
          <a
            href="https://github.com/liprep/liprep"
            target="_blank"
            rel="noopener noreferrer"
            className="retro-btn github-star-btn home-nav-action-btn"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span className="github-star-text">Star</span>
            {starCount !== null && (
              <span className="github-star-counter">{starCount}</span>
            )}
          </a>

          {/* About Button */}
          <button
            type="button"
            className="retro-btn home-about-btn home-nav-action-btn"
            onClick={() => setIsAboutOpen(true)}
          >
            About
          </button>
        </div>
      </header>

      <main className="hero-split-layout">
        <div className="hero-left-pane">
          <h1 className="hero-main-title">
            <span className="hero-first-line">
              You can't spell{" "}
              <span className="saturday-badge-wrapper">
                Saturday
                <img
                  src="/hero-star.svg"
                  alt=""
                  className="hero-corner-star-img"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </span>
            </span>
            <br />
            <span className="hero-second-line">
              without spelling{" "}
              <span className="turd-badge-wrapper">
                <img
                  src="/hero-turd-blob.svg"
                  alt=""
                  className="hero-turd-blob-img"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <span className="turd-highlight-text">turd.</span>
              </span>
            </span>
          </h1>
          <p className="hero-subtext">but your test day doesn't have to be this way.</p>
        </div>

        <div className="hero-right-pane">
          <div
            className={`dropzone-card ${isDragging ? "is-dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {questionCount && questionCount > 0 ? (
              <div className="loaded-bank-view">
                <div className="dropzone-icon loaded-icon">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h2 className="dropzone-title">Question Bank Ready</h2>
                <p className="dropzone-desc">
                  <strong>{questionCount}</strong> questions loaded in local storage
                </p>

                <div className="loaded-action-stack">
                  <Link
                    to="/filter"
                    className="retro-btn retro-btn-primary full-width-btn"
                    style={{ padding: "14px", fontSize: "1rem" }}
                  >
                    Continue to Dashboard →
                  </Link>

                  <label className="retro-btn full-width-btn" style={{ cursor: isUploading ? "wait" : "pointer" }}>
                    {isUploading ? "Importing..." : "Select new .json File"}
                    <input
                      type="file"
                      accept=".json"
                      disabled={isUploading}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) processFile(f);
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="fresh-upload-view">
                <div className="dropzone-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <h2 className="dropzone-title">
                  {isUploading ? "Ingesting Question Bank…" : "Import SAT Question Bank (.json)"}
                </h2>
                <p className="dropzone-desc">Drag & drop your College Board data file here</p>

                <label className="retro-btn retro-btn-indigo" style={{ cursor: isUploading ? "wait" : "pointer" }}>
                  {isUploading ? "Processing..." : "Select Local JSON"}
                  <input
                    type="file"
                    accept=".json"
                    disabled={isUploading}
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) processFile(f);
                    }}
                  />
                </label>
              </div>
            )}

            {uploadError && <p className="dropzone-error">{uploadError}</p>}
          </div>
        </div>
      </main>

      {/* Wall of Love Modal */}
      {isWallOfLoveOpen && (
        <WallOfLoveModal onClose={() => setIsWallOfLoveOpen(false)} />
      )}

      {/* About Modal */}
      {isAboutOpen &&
        createPortal(
          <div className="full-screen-blur-overlay" onClick={() => setIsAboutOpen(false)}>
            <div className="about-modal-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>About LiPrep</h3>
                <button
                  type="button"
                  className="retro-btn"
                  style={{ padding: "4px 10px" }}
                  onClick={() => setIsAboutOpen(false)}
                >
                  ✕
                </button>
              </div>
              <p className="about-modal-text">
                Liprep is short for Libre Prep. <br />
                <br />
                Test prep platforms have become disgustingly greedy so we felt the need for an open source, community-maintained, and zero bullshit platform to exist.
                <br />
                <br />
                Made by Zaid and Abdullah la3yoon SYE community, and beyond. Also, fuck Oneprep.
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
