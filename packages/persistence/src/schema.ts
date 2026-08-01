// Thin schema: an append-only event log plus a generic entity table keyed
// by (entity_type, entity_id) holding one JSON blob per entity, already
// validated against the matching `@foundry/contracts` Zod schema before
// write. No per-entity-type SQL columns to keep in sync with domain-model
// changes — the contracts package is the single schema source of truth.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  causation_id TEXT,
  severity TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_correlation ON events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS entities (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);
`;

export interface EventRow {
  sequence: number;
  id: string;
  type: string;
  occurred_at: string;
  actor_type: string;
  actor_id: string;
  entity_type: string;
  entity_id: string;
  correlation_id: string;
  causation_id: string | null;
  severity: string;
  schema_version: number;
  payload: string;
}
