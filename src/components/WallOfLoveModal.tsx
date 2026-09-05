import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getSolvedCount, getFirstAttemptTimestamp } from "@/db";
import "./WallOfLoveModal.css";

interface Testimony {
  id: number | string;
  name: string;
  content: string;
  created_at: number;
}

interface WallOfLoveModalProps {
  onClose: () => void;
}

const CACHED_TESTIMONIES_KEY = "liprep_cached_testimonies";
const SUBMITTED_FINGERPRINTS_KEY = "liprep_submitted_fingerprints";
const REQUIRED_SOLVED_COUNT = 15;
const BATCH_SIZE = 20;

function getStoredTestimonies(): Testimony[] {
  try {
    const raw = localStorage.getItem(CACHED_TESTIMONIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredTestimonies(items: Testimony[]): void {
  try {
    // Keep up to 60 most recent testimonies in offline storage
    localStorage.setItem(CACHED_TESTIMONIES_KEY, JSON.stringify(items.slice(0, 60)));
  } catch {}
}

export default function WallOfLoveModal({ onClose }: WallOfLoveModalProps) {
  // 1. Initialize synchronously from local memory for instant 0ms offline display
  const [testimonies, setTestimonies] = useState<Testimony[]>(() => getStoredTestimonies());
  const [solvedCount, setSolvedCount] = useState<number>(0);
  const [firstSolvedAt, setFirstSolvedAt] = useState<number | null>(null);
  const [hasAlreadySubmitted, setHasAlreadySubmitted] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState<boolean>(false);
  const remoteOffsetRef = useRef<number>(0);

  // Close modal on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Safe background fetch with 5-second abort controller
  async function fetchBatch(offset: number, limit = BATCH_SIZE): Promise<{ items: Testimony[]; hasMore: boolean } | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`/api/testimonies?limit=${limit}&offset=${offset}&_t=${Date.now()}`, {
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) return null;

      const data = await res.json();
      let items: Testimony[] = [];
      let more = false;

      if (Array.isArray(data)) {
        items = data;
        more = data.length >= limit;
      } else if (data && Array.isArray(data.testimonies)) {
        items = data.testimonies;
        more = typeof data.hasMore === "boolean" ? data.hasMore : data.testimonies.length >= limit;
      }

      return { items, hasMore: more };
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  // Load stats and background-sync testimonies
  useEffect(() => {
    let isCancelled = false;

    async function init() {
      const [count, firstTs] = await Promise.all([
        getSolvedCount(),
        getFirstAttemptTimestamp(),
      ]);

      if (isCancelled) return;
      setSolvedCount(count);
      setFirstSolvedAt(firstTs);

      if (firstTs) {
        try {
          const submitted: number[] = JSON.parse(
            localStorage.getItem(SUBMITTED_FINGERPRINTS_KEY) || "[]"
          );
          if (submitted.includes(firstTs)) {
            setHasAlreadySubmitted(true);
          }
        } catch {}
      }

      // If device is completely offline, skip background network fetch
      if (!navigator.onLine) {
        setIsOffline(true);
        return;
      }

      setIsSyncing(true);
      const result = await fetchBatch(0, BATCH_SIZE);

      if (isCancelled) return;
      setIsSyncing(false);

      if (result) {
        setIsOffline(false);
        // Merge fetched records with existing local cache without duplicates
        setTestimonies((prev) => {
          const map = new Map<string, Testimony>();
          // Remote items take priority for latest edits
          result.items.forEach((item) => map.set(String(item.id), item));
          prev.forEach((item) => {
            if (!map.has(String(item.id))) {
              map.set(String(item.id), item);
            }
          });
          const merged = Array.from(map.values()).sort((a, b) => b.created_at - a.created_at);
          saveStoredTestimonies(merged);
          return merged;
        });

        remoteOffsetRef.current = result.items.length;
        setHasMore(result.hasMore);
      } else {
        // Network call failed or timed out — fail silently and keep local cache
        setIsOffline(true);
      }
    }

    init();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function handleLoadMore() {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setLoadMoreFailed(false);

    const result = await fetchBatch(remoteOffsetRef.current, BATCH_SIZE);

    if (!result) {
      setIsLoadingMore(false);
      setLoadMoreFailed(true);
      return;
    }

    if (result.items.length > 0) {
      setTestimonies((prev) => {
        const existingIds = new Set(prev.map((t) => String(t.id)));
        const newUnique = result.items.filter((item) => !existingIds.has(String(item.id)));
        const updated = [...prev, ...newUnique].sort((a, b) => b.created_at - a.created_at);
        saveStoredTestimonies(updated);
        return updated;
      });

      remoteOffsetRef.current += result.items.length;
      setHasMore(result.hasMore);
    } else {
      setHasMore(false);
    }

    setIsLoadingMore(false);
  }

  const formatDate = (timestamp: number) => {
    if (!timestamp || !Number.isFinite(timestamp)) return "";
    const ms = timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  };

  const isUnlocked = solvedCount >= REQUIRED_SOLVED_COUNT;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isUnlocked || isSubmitting || hasAlreadySubmitted) return;

    const trimmedName = name.trim();
    const trimmedContent = content.trim();

    if (trimmedName.length < 1) {
      setStatusMessage({ text: "Name cannot be empty.", type: "error" });
      return;
    }

    if (trimmedContent.length < 1) {
      setStatusMessage({ text: "Testimony cannot be empty.", type: "error" });
      return;
    }

    let activeFirstSolvedAt = firstSolvedAt;
    if (!activeFirstSolvedAt) {
      activeFirstSolvedAt = await getFirstAttemptTimestamp();
      if (activeFirstSolvedAt) setFirstSolvedAt(activeFirstSolvedAt);
    }

    if (!activeFirstSolvedAt) {
      setStatusMessage({ text: "Practice progress not detected.", type: "error" });
      return;
    }

    // Check local duplicate fingerprint
    try {
      const submittedFingerprints: number[] = JSON.parse(
        localStorage.getItem(SUBMITTED_FINGERPRINTS_KEY) || "[]"
      );
      if (submittedFingerprints.includes(activeFirstSolvedAt)) {
        setHasAlreadySubmitted(true);
        setStatusMessage({
          text: "You have already submitted a testimony for this session.",
          type: "error",
        });
        return;
      }
    } catch {}

    if (!navigator.onLine) {
      setStatusMessage({
        text: "You are currently offline. Please reconnect to submit.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/testimonies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          content: trimmedContent,
          solvedCount,
          firstSolvedAt: activeFirstSolvedAt,
        }),
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 409) {
          try {
            const submittedFingerprints: number[] = JSON.parse(
              localStorage.getItem(SUBMITTED_FINGERPRINTS_KEY) || "[]"
            );
            if (!submittedFingerprints.includes(activeFirstSolvedAt)) {
              submittedFingerprints.push(activeFirstSolvedAt);
              localStorage.setItem(SUBMITTED_FINGERPRINTS_KEY, JSON.stringify(submittedFingerprints));
            }
          } catch {}
          setHasAlreadySubmitted(true);
        }
        throw new Error(resData?.error || `Server returned error (${res.status})`);
      }

      // Record successful fingerprint in localStorage
      try {
        const submittedFingerprints: number[] = JSON.parse(
          localStorage.getItem(SUBMITTED_FINGERPRINTS_KEY) || "[]"
        );
        if (!submittedFingerprints.includes(activeFirstSolvedAt)) {
          submittedFingerprints.push(activeFirstSolvedAt);
          localStorage.setItem(SUBMITTED_FINGERPRINTS_KEY, JSON.stringify(submittedFingerprints));
        }
      } catch {}

      const createdTestimony: Testimony = {
        id: resData?.testimony?.id || resData?.id || Date.now(),
        name: trimmedName,
        content: trimmedContent,
        created_at: resData?.testimony?.created_at || resData?.created_at || Date.now(),
      };

      // Instantly update state AND offline cache
      setTestimonies((prev) => {
        const updated = [createdTestimony, ...prev.filter((t) => String(t.id) !== String(createdTestimony.id))];
        saveStoredTestimonies(updated);
        return updated;
      });

      remoteOffsetRef.current += 1;
      setName("");
      setContent("");
      setHasAlreadySubmitted(true);
      setStatusMessage({ text: "Testimony published successfully!", type: "success" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to server.";
      setStatusMessage({ text: msg, type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div className="wol-overlay animate-fade-in" onClick={onClose}>
      <div className="wol-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Pinned Top-Right Close Button */}
        <button
          type="button"
          className="wol-pinned-close-btn"
          onClick={onClose}
          aria-label="Close Wall of Love"
        >
          ✕
        </button>

        {/* Scrollable Masonry Cards */}
        <div className="wol-body-scroll">
          {/* Subtle offline / syncing notice if applicable */}
          {isOffline && testimonies.length > 0 && (
            <div className="wol-offline-notice">
              <span>Working offline • Showing saved testimonies</span>
            </div>
          )}

          {testimonies.length === 0 ? (
            <div className="wol-empty-state">
              {isSyncing ? (
                <p style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>Syncing testimonies…</p>
              ) : isOffline ? (
                <>
                  <p style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>You are currently offline.</p>
                  <p style={{ fontSize: "0.85rem", marginTop: "6px" }}>Connect to the internet to load testimonies.</p>
                  <button
                    type="button"
                    className="retro-btn wol-retry-btn"
                    style={{ marginTop: "14px" }}
                    onClick={() => {
                      setIsSyncing(true);
                      fetchBatch(0, BATCH_SIZE).then((res) => {
                        setIsSyncing(false);
                        if (res) {
                          setTestimonies(res.items);
                          saveStoredTestimonies(res.items);
                          setIsOffline(false);
                        }
                      });
                    }}
                  >
                    Check connection ↻
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>No testimonies yet.</p>
                  <p style={{ fontSize: "0.85rem", marginTop: "6px" }}>Be the first to share your experience!</p>
                </>
              )}
            </div>
          ) : (
            <div className="wol-masonry-grid">
              {testimonies.map((item, idx) => (
                <article key={item.id} className="wol-card-item">
                  <div className="wol-card-top-decor">
                    <div className="wol-quote-mark">
                      <svg width="26" height="18" viewBox="0 0 24 18" fill="currentColor">
                        <path d="M0 11.25C0 5.034 4.025 0.5 9.4 0.5V4.625C6.7 4.625 4.8 6.55 4.8 9.3V10.375H9.4V17.5H0V11.25ZM14.6 11.25C14.6 5.034 18.625 0.5 24 0.5V4.625C21.3 4.625 19.4 6.55 19.4 9.3V10.375H24V17.5H14.6V11.25Z" />
                      </svg>
                    </div>
                    <span className="wol-serial-index">
                      #{String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <p className="wol-quote-text">{item.content}</p>

                  <div className="wol-card-footer">
                    <span className="wol-author-name">{item.name}</span>
                    <span className="wol-date-stamp">{formatDate(item.created_at)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Load More Trigger */}
          {hasMore && (
            <div className="wol-load-more-row">
              <button
                type="button"
                className="retro-btn wol-load-more-btn"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading more..." : "Load more testimonies ↓"}
              </button>
            </div>
          )}

          {/* Safe failure retry button */}
          {loadMoreFailed && (
            <div className="wol-load-more-row">
              <button
                type="button"
                className="retro-btn wol-retry-btn"
                onClick={handleLoadMore}
              >
                Slow connection. Tap to retry ↻
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Bottom Tray */}
        <footer className={`wol-collapsible-footer ${isExpanded ? "is-expanded" : ""}`}>
          <button
            type="button"
            className="wol-drawer-toggle-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
          >
            <div className="wol-drawer-toggle-left">
              {!isUnlocked ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Add testimony</span>
                  <span className="wol-toggle-badge locked">
                    {solvedCount} / {REQUIRED_SOLVED_COUNT} solved
                  </span>
                </>
              ) : hasAlreadySubmitted ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Testimony submitted</span>
                  <span className="wol-toggle-badge submitted">
                    Submitted ✓
                  </span>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  <span>Add testimony</span>
                </>
              )}
            </div>

            <div className="wol-drawer-toggle-right">
              <span className="wol-drawer-chevron">{isExpanded ? "▼" : "▲"}</span>
            </div>
          </button>

          {/* Drawer Body */}
          {isExpanded && (
            <div className="wol-drawer-content animate-fade-in">
              {!isUnlocked ? (
                <div className="wol-locked-banner">
                  <div className="wol-locked-row-top">
                    <span className="wol-lock-headline">
                      Requires {REQUIRED_SOLVED_COUNT} solved questions to publish
                    </span>
                  </div>

                  <div className="wol-stepper-track" title={`${solvedCount} of ${REQUIRED_SOLVED_COUNT} questions solved`}>
                    {Array.from({ length: REQUIRED_SOLVED_COUNT }).map((_, stepIdx) => (
                      <div
                        key={stepIdx}
                        className={`wol-step-segment ${stepIdx < solvedCount ? "is-active" : ""}`}
                      />
                    ))}
                  </div>
                </div>
              ) : hasAlreadySubmitted ? (
                <div className="wol-submitted-banner">
                  <div className="wol-submitted-icon">✓</div>
                  <div>
                    <h4 className="wol-submitted-title">You've already submitted a testimony!</h4>
                    <p className="wol-submitted-desc">
                      Thank you. Your review helps other students in seeing if LiPrep is worth their time!
                    </p>
                  </div>
                </div>
              ) : (
                <form className="wol-dispatch-form" onSubmit={handleSubmit}>
                  <div className="wol-dispatch-inputs-row">
                    <input
                      type="text"
                      placeholder="Your Name"
                      className="wol-retro-input wol-retro-input-name"
                      value={name}
                      maxLength={30}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <textarea
                    placeholder="Share your experience practicing on LiPrep..."
                    className="wol-retro-textarea"
                    value={content}
                    maxLength={300}
                    onChange={(e) => setContent(e.target.value)}
                    required
                  />

                  <div className="wol-dispatch-bottom-bar">
                    <span className="wol-counter-indicator">{content.length} / 300</span>
                    {statusMessage && (
                      <span className={`wol-action-status ${statusMessage.type}`}>{statusMessage.text}</span>
                    )}
                    <button
                      type="submit"
                      className="retro-btn retro-btn-primary"
                      style={{ padding: "8px 20px", fontSize: "0.88rem" }}
                      disabled={isSubmitting || name.trim().length < 1 || content.trim().length < 1}
                    >
                      {isSubmitting ? "Publishing..." : "Publish Testimony"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </footer>
      </div>
    </div>,
    document.body
  );
}
