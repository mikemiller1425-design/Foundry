"use client";

import { useEffect, useState } from "react";
import { isAtmosphereMode, type AtmosphereMode } from "./atmosphere";

const STORAGE_KEY = "foundry.visual-atmosphere.v1";

export interface AtmospherePreference {
  mode: AtmosphereMode;
  ambientMotion: boolean;
}

const DEFAULT_PREFERENCE: AtmospherePreference = { mode: "focus", ambientMotion: true };

function readPreference(): AtmospherePreference {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCE;
    const parsed = JSON.parse(raw) as Partial<AtmospherePreference>;
    return {
      mode: isAtmosphereMode(parsed.mode) ? parsed.mode : DEFAULT_PREFERENCE.mode,
      ambientMotion:
        typeof parsed.ambientMotion === "boolean"
          ? parsed.ambientMotion
          : DEFAULT_PREFERENCE.ambientMotion,
    };
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

export function useAtmospherePreference() {
  const [preference, setPreference] = useState<AtmospherePreference>(DEFAULT_PREFERENCE);

  useEffect(() => setPreference(readPreference()), []);
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
    } catch {
      // Personalization remains usable in-memory when storage is unavailable.
    }
  }, [preference]);

  return {
    preference,
    setMode: (mode: AtmosphereMode) => setPreference((current) => ({ ...current, mode })),
    setAmbientMotion: (ambientMotion: boolean) =>
      setPreference((current) => ({ ...current, ambientMotion })),
  };
}
