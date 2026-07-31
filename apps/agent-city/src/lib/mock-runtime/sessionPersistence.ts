// Frontend-local only (sessionStorage) — never a backend. Stores just enough
// to reconstruct history after reload: the seed and how far the
// deterministic script had advanced. The events themselves are never
// stored; they are regenerated identically from the seed (FBL-009 "history
// reconstruction ... using deterministic mock state, without adding
// backend persistence").
const STORAGE_KEY = "foundry.mock-runtime.cursor";

export interface RuntimeCursorMarker {
  seed: string;
  cursor: number;
}

function hasSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function saveRuntimeCursor(marker: RuntimeCursorMarker): void {
  if (!hasSessionStorage()) return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(marker));
}

export function loadRuntimeCursor(): RuntimeCursorMarker | null {
  if (!hasSessionStorage()) return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "seed" in parsed &&
      "cursor" in parsed &&
      typeof (parsed as RuntimeCursorMarker).seed === "string" &&
      typeof (parsed as RuntimeCursorMarker).cursor === "number"
    ) {
      return parsed as RuntimeCursorMarker;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearRuntimeCursor(): void {
  if (!hasSessionStorage()) return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
