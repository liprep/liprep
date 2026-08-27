import { useEffect, useState } from "react";
import "./TopicSelection.css";
import { topicTree } from "./TopicTree";
import { getNumberRemainingPerTopic } from "@/db";

interface TopicSelectionProps {
  selected: Set<string>;
  setSelected: (updater: (prev: Set<string>) => Set<string>) => void;
  difficulty: Set<number>;
  solvedStatus: string;
  excludeBluebook: boolean;
}

export default function TopicSelection({
  selected,
  setSelected,
  difficulty,
  solvedStatus,
  excludeBluebook,
}: TopicSelectionProps) {
  const [remainingCounts, setRemainingCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const counts = await getNumberRemainingPerTopic(
        Array.from(difficulty),
        solvedStatus,
        excludeBluebook
      );
      if (!cancelled) {
        setRemainingCounts(counts);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [difficulty, solvedStatus, excludeBluebook]);

  function toggleOne(topicName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(topicName)) next.delete(topicName);
      else next.add(topicName);
      return next;
    });
  }

  function toggleGroup(childrenTopics: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = childrenTopics.every((topic) => prev.has(topic));
      childrenTopics.forEach((child) => {
        if (allSelected) next.delete(child);
        else next.add(child);
      });
      return next;
    });
  }

  function toggleModule(data: Record<string, string[]>) {
    const allTopics = Object.values(data).flat();
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = allTopics.every((t) => prev.has(t));
      allTopics.forEach((t) => {
        if (allSelected) next.delete(t);
        else next.add(t);
      });
      return next;
    });
  }

  return (
    <div className="topic-selection-container">
      {/* Reading & Writing Card Wrapper */}
      <div className="module-column-wrapper">
        <img
          src="/bg-blob-orange.svg"
          alt=""
          className="card-bg-blob blob-ebrw-bottom-left animated-blob-1"
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />

        <div className="module-column-card ebrw-card-rect">
          <div className="module-card-header">
            <div className="title-with-cosmetics">
              <h3 className="module-badge-title">EBRW</h3>
              <div className="header-cosmetic-icons">
                <img
                  src="/ebrw-icon-1.svg"
                  alt=""
                  className="cosmetic-svg-icon"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <img
                  src="/ebrw-icon-2.svg"
                  alt=""
                  className="cosmetic-svg-icon"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              className="module-select-all-btn"
              onClick={() => toggleModule(topicTree.reading)}
            >
              {Object.values(topicTree.reading).flat().every((t) => selected.has(t))
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>

          <div className="domain-scroll-area">
            {Object.entries(topicTree.reading).map(([group, childrenTopics]) => {
              const allGroupSelected = childrenTopics.every((t) => selected.has(t));
              const someGroupSelected = childrenTopics.some((t) => selected.has(t));
              const groupCount = childrenTopics.reduce(
                (acc, child) => acc + (remainingCounts[child] || 0),
                0
              );

              return (
                <div key={group} className="domain-group">
                  <div
                    className="domain-group-header"
                    onClick={() => toggleGroup(childrenTopics)}
                  >
                    <div className="domain-header-left">
                      <div
                        className={`custom-checkbox ${
                          allGroupSelected
                            ? "checked"
                            : someGroupSelected
                            ? "indeterminate"
                            : ""
                        }`}
                      >
                        {allGroupSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {!allGroupSelected && someGroupSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        )}
                      </div>
                      <span>{group}</span>
                    </div>
                    <span className="remaining-pill">{groupCount}</span>
                  </div>

                  <div className="subtopic-list">
                    {childrenTopics.map((childTopic) => {
                      const isChecked = selected.has(childTopic);
                      const count = remainingCounts[childTopic] || 0;

                      return (
                        <label
                          key={childTopic}
                          className="subtopic-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOne(childTopic);
                          }}
                        >
                          <div className="subtopic-left">
                            <div className={`custom-checkbox ${isChecked ? "checked" : ""}`}>
                              {isChecked && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                            <span className="subtopic-name">{childTopic}</span>
                          </div>
                          <span className="subtopic-count">{count}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Math Card Wrapper */}
      <div className="module-column-wrapper">
        <img
          src="/bg-blob-purple.svg"
          alt=""
          className="card-bg-blob blob-math-top-right animated-blob-2"
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />

        <div className="module-column-card math-card-rect">
          <div className="module-card-header">
            <div className="title-with-cosmetics">
              <h3 className="module-badge-title">Math</h3>
              <div className="header-cosmetic-icons">
                <img
                  src="/math-icon-1.svg"
                  alt=""
                  className="cosmetic-svg-icon"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <img
                  src="/math-icon-2.svg"
                  alt=""
                  className="cosmetic-svg-icon"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            </div>

            <button
              type="button"
              className="module-select-all-btn"
              onClick={() => toggleModule(topicTree.math)}
            >
              {Object.values(topicTree.math).flat().every((t) => selected.has(t))
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>

          <div className="domain-scroll-area">
            {Object.entries(topicTree.math).map(([group, childrenTopics]) => {
              const allGroupSelected = childrenTopics.every((t) => selected.has(t));
              const someGroupSelected = childrenTopics.some((t) => selected.has(t));
              const groupCount = childrenTopics.reduce(
                (acc, child) => acc + (remainingCounts[child] || 0),
                0
              );

              return (
                <div key={group} className="domain-group">
                  <div
                    className="domain-group-header"
                    onClick={() => toggleGroup(childrenTopics)}
                  >
                    <div className="domain-header-left">
                      <div
                        className={`custom-checkbox ${
                          allGroupSelected
                            ? "checked"
                            : someGroupSelected
                            ? "indeterminate"
                            : ""
                        }`}
                      >
                        {allGroupSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {!allGroupSelected && someGroupSelected && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                        )}
                      </div>
                      <span>{group}</span>
                    </div>
                    <span className="remaining-pill">{groupCount}</span>
                  </div>

                  <div className="subtopic-list">
                    {childrenTopics.map((childTopic) => {
                      const isChecked = selected.has(childTopic);
                      const count = remainingCounts[childTopic] || 0;

                      return (
                        <label
                          key={childTopic}
                          className="subtopic-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOne(childTopic);
                          }}
                        >
                          <div className="subtopic-left">
                            <div className={`custom-checkbox ${isChecked ? "checked" : ""}`}>
                              {isChecked && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                            <span className="subtopic-name">{childTopic}</span>
                          </div>
                          <span className="subtopic-count">{count}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
