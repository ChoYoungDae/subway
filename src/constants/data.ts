import type { NavTab } from "../types";

// ─────────────────────────────────────────────
// Line colors (indexed by LineNumber)
// ─────────────────────────────────────────────

export const LINE_COLORS: Record<string, string> = {
  // 숫자 키 (기존 호환)
  "1": "#0052A4", "2": "#00A84D", "3": "#EF7C1C", "4": "#00A5DE",
  "5": "#996CAC", "6": "#CD7C2F", "7": "#747F00", "8": "#E6186C",
  "9": "#BDB092", "A": "#3498DB", "B": "#E74C3C",
  // DB 텍스트 키
  "1호선": "#0052A4", "2호선": "#00A84D", "3호선": "#EF7C1C", "4호선": "#00A5DE",
  "5호선": "#996CAC", "6호선": "#CD7C2F", "7호선": "#747F00", "8호선": "#E6186C",
  "9호선": "#BDB092", "공항철도": "#3498DB",
};

// ─────────────────────────────────────────────
// Step color classes (Tailwind)
// ─────────────────────────────────────────────

export const STEP_COLORS: Record<string, string> = {
  entrance: "bg-[#C8362A]",
  elevator: "bg-[#C8362A]",
  gate:     "bg-[#8A9CA3]",
  board:    "bg-[#8A9CA3]",
  alight:   "bg-[#2E5E4A]",
  exit:     "bg-[#2E5E4A]",
};

// ─────────────────────────────────────────────
// Bottom nav tab definitions
// ─────────────────────────────────────────────

export const NAV_TABS: NavTab[] = [
  { id: "route", icon: "🗺️", en: "Route", ko: "경로" },
  { id: "station", icon: "🚉", en: "Station", ko: "역 정보" },
  { id: "help", icon: "❓", en: "Help", ko: "도움말" },
  { id: "settings", icon: "⚙️", en: "Settings", ko: "설정" },
];
