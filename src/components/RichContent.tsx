import DOMPurify from "dompurify";
import parse, { type DOMNode, type Element } from "html-react-parser";
import { useMemo } from "react";

interface RichContentProps {
  content?: string | null;
  className?: string;
}

const mathMLTags = [
  "math",
  "mrow",
  "mn",
  "mo",
  "mi",
  "mtext",
  "mspace",
  "ms",
  "mglyph",
  "mfenced",
  "mfrac",
  "msqrt",
  "mroot",
  "mstyle",
  "merror",
  "mpadded",
  "mphantom",
  "msub",
  "msup",
  "msubsup",
  "munder",
  "mover",
  "munderover",
  "mmultiscripts",
  "mtable",
  "mtr",
  "mtd",
  "maligngroup",
  "malignmark",
  "semantics",
  "annotation",
];

const svgTags = [
  "svg",
  "g",
  "path",
  "defs",
  "use",
  "clippath",
  "clipPath",
  "rect",
  "circle",
  "line",
  "polygon",
  "polyline",
  "ellipse",
  "text",
  "tspan",
  "style",
  "figure",
  "figcaption",
];

/**
 * Modern browsers have deprecated MathML `<mfenced>`.
 * This transforms `<mfenced>` into standard `<mrow><mo>(</mo>...<mo>)</mo></mrow>`
 * so parentheses and separators render properly in all browsers.
 */
function transformMfenced(html: string): string {
  if (!html.includes("<mfenced") && !html.includes("<mfenced/")) {
    return html;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");
    const mfencedElements = Array.from(doc.querySelectorAll("mfenced"));

    for (let i = mfencedElements.length - 1; i >= 0; i--) {
      const el = mfencedElements[i];
      const open = el.hasAttribute("open") ? el.getAttribute("open") : "(";
      const close = el.hasAttribute("close") ? el.getAttribute("close") : ")";
      const separatorsAttr = el.getAttribute("separators");

      let separators: string[] = [","];
      if (separatorsAttr !== null) {
        separators = separatorsAttr.replace(/\s+/g, "").split("");
      }

      const newMrow = doc.createElement("mrow");

      if (open) {
        const moOpen = doc.createElement("mo");
        moOpen.textContent = open;
        newMrow.appendChild(moOpen);
      }

      const children = Array.from(el.childNodes);
      children.forEach((child, idx) => {
        newMrow.appendChild(child);
        if (idx < children.length - 1 && separators.length > 0) {
          const sepChar =
            idx < separators.length
              ? separators[idx]
              : separators[separators.length - 1];
          if (sepChar) {
            const moSep = doc.createElement("mo");
            moSep.textContent = sepChar;
            newMrow.appendChild(moSep);
          }
        }
      });

      if (close) {
        const moClose = doc.createElement("mo");
        moClose.textContent = close;
        newMrow.appendChild(moClose);
      }

      el.parentNode?.replaceChild(newMrow, el);
    }

    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

export default function RichContent({
  content,
  className = "",
}: RichContentProps) {
  const renderedContent = useMemo(() => {
    if (!content) return null;

    let preprocessed = content;

    // 1. Normalize screen-reader blanks
    preprocessed = preprocessed.replace(
      /<span aria-hidden="true">_+<\/span><span class="sr-only">blank<\/span>/gi,
      '<span class="sat-blank" aria-label="blank space"></span>'
    );
    preprocessed = preprocessed.replace(
      /_{4,}/g,
      '<span class="sat-blank"></span>'
    );

    // 2. Fix degree symbol spacing quirks
    preprocessed = preprocessed.replace(/&deg;/g, "°");

    // 3. Transform deprecated MathML <mfenced> to explicit <mo> fence tags
    preprocessed = transformMfenced(preprocessed);

    // 4. Clean and sanitize HTML, SVG & MathML
    const cleanHTML = DOMPurify.sanitize(preprocessed, {
      USE_PROFILES: { html: true, svg: true, mathMl: true, svgFilters: true },
      ADD_TAGS: [
        ...mathMLTags,
        ...svgTags,
        "table",
        "thead",
        "tbody",
        "tr",
        "th",
        "td",
        "figure",
        "img",
        "ul",
        "ol",
        "li",
        "em",
        "strong",
        "b",
        "i",
        "u",
        "span",
        "p",
        "div",
      ],
      ADD_ATTR: [
        "src",
        "alt",
        "alttext",
        "aria-hidden",
        "aria-label",
        "class",
        "colspan",
        "rowspan",
        "style",
        "viewBox",
        "xmlns",
        "xmlns:xlink",
        "xlink:href",
        "href",
        "clip-path",
        "clipPath",
        "clip-rule",
        "fill",
        "stroke",
        "stroke-width",
        "stroke-linecap",
        "stroke-linejoin",
        "stroke-dasharray",
        "transform",
        "d",
        "id",
        "x",
        "y",
        "width",
        "height",
        "display",
        "mathvariant",
        "accent",
        "accentunder",
        "align",
        "rowalign",
        "columnalign",
        "version",
        "role",
        "loading",
      ],
    });

    return parse(cleanHTML, {
      replace: (domNode: DOMNode) => {
        if (domNode.type === "tag" && (domNode as Element).name === "table") {
          const el = domNode as Element;
          el.attribs.class = `${el.attribs.class || ""} sat-table`.trim();
        }
      },
    });
  }, [content]);

  if (!renderedContent) return null;

  return (
    <div className={`sat-rich-content ${className}`}>{renderedContent}</div>
  );
}
