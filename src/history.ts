import type { HistoryEntry, TranscriptTurn } from "./types.ts";

const KEY = "logicc-call-history-v1";

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory().filter((item) => item.id !== entry.id)].slice(0, 8);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function turnsForHistory(turns: TranscriptTurn[]): HistoryEntry["turns"] {
  return turns
    .filter((turn) => !turn.live && turn.text.trim() && turn.text !== "…")
    .map((turn) => ({ role: turn.role, text: turn.text }));
}
