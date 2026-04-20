// ─────────────────────────────────────────────
// ExitBadge.tsx
// ─────────────────────────────────────────────
// Yellow (#FFD500) exit number badge matching Seoul signage standard.

interface ExitBadgeProps {
  num: number;
  size?: "sm" | "lg";
}

export function ExitBadge({ num, size = "sm" }: ExitBadgeProps) {
  const cls = size === "lg"
    ? "text-base px-2 py-1 min-w-[2rem]"
    : "text-xs px-1.5 py-0.5 min-w-[1.4rem]";
  return (
    <span
      className={`inline-flex items-center justify-center font-black rounded ${cls}`}
      style={{ background: "#FFD500", color: "#111" }}
    >
      {num}
    </span>
  );
}


// ─────────────────────────────────────────────
// LineBadge.tsx
// ─────────────────────────────────────────────
// Circular badge colored by subway line number.

import { LINE_COLORS } from "../../constants/data";
import type { LineNumber } from "../../types";

interface LineBadgeProps {
  line: LineNumber;
}

export function LineBadge({ line }: LineBadgeProps) {
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white font-bold text-xs flex-shrink-0"
      style={{ background: LINE_COLORS[String(line)] ?? "#888" }}
    >
      {line}
    </span>
  );
}


// ─────────────────────────────────────────────
// BiLabel.tsx
// ─────────────────────────────────────────────
// Bilingual label: English (bold, above) + Korean (dimmed, below).

interface BiLabelProps {
  en: string;
  ko: string;
  enClass?: string;
  koClass?: string;
}

export function BiLabel({
  en,
  ko,
  enClass = "text-sm font-semibold text-gray-900",
  koClass = "text-xs text-gray-400 mt-0.5",
}: BiLabelProps) {
  return (
    <div>
      <div className={enClass}>{en}</div>
      <div className={koClass}>{ko}</div>
    </div>
  );
}
