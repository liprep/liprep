import { useState, useEffect } from "react";

interface MathReferenceSheetProps {
  onClose: () => void;
}

const ROW_1_SVGS = [
  { id: 1, file: "/reference/1.svg", alt: "Circle: A = πr², C = 2πr" },
  { id: 2, file: "/reference/2.svg", alt: "Rectangle: A = lw" },
  { id: 3, file: "/reference/3.svg", alt: "Triangle: A = 1/2 bh" },
  { id: 4, file: "/reference/4.svg", alt: "Pythagorean Theorem: c² = a² + b²" },
];

const ROW_2_SVGS = [
  { id: 5, file: "/reference/5.svg", alt: "Rectangular Prism: V = lwh" },
  { id: 6, file: "/reference/6.svg", alt: "Right Cylinder: V = πr²h" },
  { id: 7, file: "/reference/7.svg", alt: "Sphere: V = 4/3 πr³" },
  { id: 8, file: "/reference/8.svg", alt: "Right Cone: V = 1/3 πr²h" },
  { id: 9, file: "/reference/9.svg", alt: "Pyramid: V = 1/3 lwh" },
  { id: 10, file: "/reference/10.svg", alt: "Additional formula graphic 10" },
  { id: 11, file: "/reference/11.svg", alt: "Additional formula graphic 11" },
];

export default function MathReferenceSheet({ onClose }: MathReferenceSheetProps) {
  const [position, setPosition] = useState({ x: 50, y: 60 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging) return;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - 380, e.clientX - dragOffset.x)),
        y: Math.max(50, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y)),
      });
    }

    function handleMouseUp() {
      setIsDragging(false);
    }

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="reference-floating-window"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    >
      <div
        className="reference-window-header"
        onMouseDown={(e) => {
          setIsDragging(true);
          setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
          });
        }}
      >
        <div className="reference-window-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 22h20M2 22l10-18 10 18M7 13h10" />
          </svg>
          <span>Reference</span>
        </div>
        <button
          type="button"
          className="reference-window-close-btn"
          onClick={onClose}
          aria-label="Close reference sheet"
        >
          ✕
        </button>
      </div>

      <div className="reference-window-content">
        {/* Row 1: 2D Formulas + 2x-width Special Triangles */}
        <div className="reference-formulas-row">
          {ROW_1_SVGS.map((item) => (
            <div key={item.id} className="reference-svg-cell">
              <img src={item.file} alt={item.alt} className="reference-img" draggable={false} />
            </div>
          ))}

          <div className="reference-svg-cell reference-cell-double">
            <img
              src="/reference/special-triangles.png"
              alt="Special Right Triangles"
              className="reference-img reference-img-double"
              draggable={false}
            />
          </div>
        </div>

        {/* Row 2: 3D Solids */}
        <div className="reference-formulas-row">
          {ROW_2_SVGS.map((item) => (
            <div key={item.id} className="reference-svg-cell">
              <img src={item.file} alt={item.alt} className="reference-img" draggable={false} />
            </div>
          ))}
        </div>

        {/* Rules & Facts */}
        <div className="reference-rules-section">
          <p className="reference-rule-text">The number of degrees of arc in a circle is 360.</p>
          <p className="reference-rule-text">
            The number of radians of arc in a circle is 2<em>π</em>.
          </p>
          <p className="reference-rule-text">
            The sum of the measures in degrees of the angles of a triangle is 180.
          </p>
        </div>
      </div>
    </div>
  );
}
