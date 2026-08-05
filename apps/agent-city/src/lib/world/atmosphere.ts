export type AtmosphereMode = "focus" | "aurora" | "ember";

export interface AtmosphereDefinition {
  id: AtmosphereMode;
  label: string;
  description: string;
  background: string;
  fog: string;
  ground: string;
  grid: string;
  hemisphereSky: string;
  keyLight: string;
  ambientSignal: string;
}

/** Visual-only palettes. Operational/status colors are intentionally absent. */
export const ATMOSPHERES: readonly AtmosphereDefinition[] = [
  {
    id: "focus",
    label: "Focus",
    description: "Cool, quiet contrast for close operational reading.",
    background: "#09111f",
    fog: "#09111f",
    ground: "#111b2b",
    grid: "#34435b",
    hemisphereSky: "#b9ddff",
    keyLight: "#fff2db",
    ambientSignal: "#64d8ff",
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Luminous cyan-violet depth for exploratory world wandering.",
    background: "#071226",
    fog: "#0b1830",
    ground: "#101b31",
    grid: "#40527c",
    hemisphereSky: "#bde7ff",
    keyLight: "#d8d2ff",
    ambientSignal: "#9d8cff",
  },
  {
    id: "ember",
    label: "Ember",
    description: "Warm late-shift light without changing operational meaning.",
    background: "#171016",
    fog: "#21151c",
    ground: "#211923",
    grid: "#59404a",
    hemisphereSky: "#ffd7b0",
    keyLight: "#ffc58c",
    ambientSignal: "#f4b860",
  },
] as const;

export function atmosphereById(id: AtmosphereMode): AtmosphereDefinition {
  return ATMOSPHERES.find((candidate) => candidate.id === id) ?? ATMOSPHERES[0]!;
}

export function isAtmosphereMode(value: unknown): value is AtmosphereMode {
  return ATMOSPHERES.some((candidate) => candidate.id === value);
}
