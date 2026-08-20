import { useState, useMemo } from "react";

interface MonthCalendarProps {
  activityData?: Record<string, number>;
  themeColor?: string;
  showMonthLabel?: boolean;
  showWeekdayLabels?: boolean;
  showNavButtons?: boolean;
  showLegend?: boolean;
  unitLabel?: string;
  maxWidth?: string;
  onDayClick?: (dateKey: string, count: number) => void;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateKey(year: number, month: number, day: number) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export default function MonthCalendar({
  activityData = {},
  themeColor: _themeColor = "#10375C",
  showMonthLabel = true,
  showWeekdayLabels = true,
  showNavButtons = true,
  showLegend = true,
  unitLabel = "questions",
  maxWidth = "320px",
  onDayClick,
}: MonthCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [hoveredDay, setHoveredDay] = useState<{ day: number; count: number; dateKey: string } | null>(null);

  const maxActivity = useMemo(() => {
    const values = Object.values(activityData);
    if (values.length === 0) return 1;
    return Math.max(1, ...values);
  }, [activityData]);

  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const days: Array<{
      isPlaceholder: boolean;
      day?: number;
      dateKey?: string;
      activity?: number;
      isToday?: boolean;
    }> = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({ isPlaceholder: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = formatDateKey(currentYear, currentMonth, d);
      days.push({
        isPlaceholder: false,
        day: d,
        dateKey,
        activity: activityData[dateKey] || 0,
        isToday:
          d === today.getDate() &&
          currentMonth === today.getMonth() &&
          currentYear === today.getFullYear(),
      });
    }

    return days;
  }, [currentYear, currentMonth, activityData, today]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const getHeatmapColor = (count: number) => {
    if (!count || count <= 0) return "#EBF0F5";
    const ratio = Math.min(count / maxActivity, 1);
    if (ratio < 0.25) return "#A0C4E8";
    if (ratio < 0.5) return "#6DABE6";
    if (ratio < 0.75) return "#3D7EB8";
    return "#10375C";
  };

  return (
    <div style={{ maxWidth, width: "100%", margin: "0 auto", position: "relative" }}>
      {showMonthLabel && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#10375C" }}>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h4>
          {showNavButtons && (
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                style={{
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  background: "#fff",
                  width: "26px",
                  height: "26px",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "#10375C",
                }}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                style={{
                  border: "1px solid #CBD5E1",
                  borderRadius: "6px",
                  background: "#fff",
                  width: "26px",
                  height: "26px",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "#10375C",
                }}
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}

      {showWeekdayLabels && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", marginBottom: "6px", textAlign: "center" }}>
          {WEEKDAYS.map((wd, i) => (
            <span key={i} style={{ fontSize: "0.72rem", color: "#94A3B8", fontWeight: 600 }}>
              {wd}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px" }}>
        {calendarDays.map((cell, idx) => {
          if (cell.isPlaceholder) {
            return <div key={`ph-${idx}`} style={{ visibility: "hidden", aspectRatio: "1" }} />;
          }

          const count = cell.activity || 0;
          const bg = getHeatmapColor(count);

          return (
            <div
              key={cell.dateKey}
              style={{
                aspectRatio: "1",
                borderRadius: "6px",
                backgroundColor: bg,
                border: cell.isToday ? "2px solid #FF9955" : "none",
                cursor: "pointer",
                position: "relative",
                transition: "transform 0.1s ease",
              }}
              onMouseEnter={() =>
                setHoveredDay({
                  day: cell.day!,
                  count,
                  dateKey: cell.dateKey!,
                })
              }
              onMouseLeave={() => setHoveredDay(null)}
              onClick={() => onDayClick && onDayClick(cell.dateKey!, count)}
            />
          );
        })}
      </div>

      {hoveredDay && (
        <div
          style={{
            position: "absolute",
            bottom: "-32px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#10375C",
            color: "#FFF",
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "0.75rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 10,
          }}
        >
          {SHORT_MONTHS[currentMonth]} {hoveredDay.day}: {hoveredDay.count} {unitLabel}
        </div>
      )}

      {showLegend && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", marginTop: "12px" }}>
          <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>Less</span>
          {["#EBF0F5", "#A0C4E8", "#6DABE6", "#3D7EB8", "#10375C"].map((c, i) => (
            <div key={i} style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: c }} />
          ))}
          <span style={{ fontSize: "0.7rem", color: "#94A3B8" }}>More</span>
        </div>
      )}
    </div>
  );
}
