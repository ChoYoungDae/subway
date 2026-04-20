// ─────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────

export type LineNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "A" | "B";

export interface ExitInfo {
  num: number;
  elev: boolean;
}

export interface Station {
  id: number;
  name: string;       // English
  ko: string;         // Korean
  line: LineNumber;
  exits: ExitInfo[];
}

/** A station with a chosen exit — used for origin/destination */
export interface SelectedStation extends Omit<Station, "exits"> {
  exit: number;
}

export interface RecentSearch {
  from: SelectedStation;
  to: SelectedStation;
}

// ─────────────────────────────────────────────
// Route / Timeline types
// ─────────────────────────────────────────────

export type StepType =
  | "entrance"
  | "elevator"
  | "gate"
  | "board"
  | "alight"
  | "exit";

export interface RouteStep {
  type: StepType;
  icon: string;
  en: string;         // English label
  ko: string;         // Korean label
  detail?: string;
}

export interface RouteSegment {
  station: SelectedStation;
  transfer?: boolean;
  steps: RouteStep[];
}

// ─────────────────────────────────────────────
// Navigation types
// ─────────────────────────────────────────────

export type TabId = "route" | "station" | "help" | "settings";

export interface NavTab {
  id: TabId;
  icon: string;
  en: string;
  ko: string;
}

// ─────────────────────────────────────────────
// View-state type (Route tab internal)
// ─────────────────────────────────────────────

export type RouteView = "idle" | "searching" | "result";
