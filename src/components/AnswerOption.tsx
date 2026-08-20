import RichContent from "./RichContent";
import "./AnswerOption.css";

interface AnswerOptionProps {
  label: string;
  content: string;
  selected: boolean;
  eliminated: boolean;
  revealed: boolean;
  isCorrect: boolean;
  showEliminateMode: boolean;
  onSelect: () => void;
  onToggleEliminate: () => void;
}

export default function AnswerOption({
  label,
  content,
  selected,
  eliminated,
  revealed,
  isCorrect,
  showEliminateMode,
  onSelect,
  onToggleEliminate,
}: AnswerOptionProps) {
  let statusClass = "";
  if (revealed) {
    if (isCorrect) statusClass = "is-correct";
    else if (selected && !isCorrect) statusClass = "is-incorrect";
  }

  return (
    <div
      className={`bb-option-row ${selected ? "is-selected" : ""} ${
        eliminated ? "is-eliminated" : ""
      } ${statusClass}`}
    >
      <button
        className="bb-option-pill"
        type="button"
        onClick={onSelect}
        disabled={revealed || eliminated}
        aria-pressed={selected}
      >
        <span className="bb-option-circle">{label}</span>
        <RichContent content={content} className="bb-option-text" />
      </button>

      {/* Bluebook Strikethrough Eliminate Toggle */}
      {!revealed && showEliminateMode && (
        <button
          className={`bb-strikethrough-btn ${eliminated ? "is-eliminated" : ""}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleEliminate();
          }}
          title={eliminated ? "Restore choice" : "Eliminate choice"}
          aria-label={`Eliminate choice ${label}`}
        >
          <span className="bb-strikethrough-letter">{label}</span>
          <span className="bb-strikethrough-line" />
        </button>
      )}
    </div>
  );
}
