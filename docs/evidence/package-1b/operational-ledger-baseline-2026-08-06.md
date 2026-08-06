# Operational ledger — logical baseline and the retirement of raw file hashes

**Type:** Evidence record
**Date:** 2026-08-06
**Subject:** `apps/api/data/foundry.sqlite`
**Operator ruling:** Option A — physical-only rewrite; adopt a portable logical baseline (§ 15 of `docs/01-mission/foundry-package-1b-decision-record-2026-08-05.md`)

---

## 1. Why the old gate failed

Every package from 1a onward recorded the operational database as unchanged by citing a **raw SHA-256 of the SQLite file**, beginning `8dd834d7`. On 2026-08-05 the file hashed
`258658519428319b4a2d77316f0471e5aec9fcb0e56ad2d75a8edd3b7c50768b`
with **identical counts** — 135 events, 39 entities.

A read-only audit established that the raw-file gate was never sound for this file. `PersistenceService` opens SQLite in WAL mode:

```
new DatabaseSync(path)
db.exec("PRAGMA journal_mode = WAL;")
db.exec(SCHEMA_SQL)      // CREATE TABLE/INDEX IF NOT EXISTS
rebuildFromLog()         // SELECT * ORDER BY sequence ASC
```

Two operations in an ordinary lifecycle rewrite bytes without touching a single row:

- **Open** creates `-wal` and `-shm`.
- **Close** checkpoints the WAL back into the main file, writes those pages, and **increments the file change counter** — a header field defined to change on write.

So a start-and-stop can produce a different file hash for an identical ledger. The gate was measuring the container while claiming to measure the ledger, and those are different facts.

This is the third instance of one defect class in this record: § 8, where a fingerprint implied a completeness it did not have; § 12, where a conversational habit was written up as a standing rule; and now a container hash standing in for ledger equality. In each case the artifact read as more authoritative than the fact behind it.

---

## 2. Audit findings — 2026-08-06, read-only

The live file was only `stat`-ed and hashed. Every logical read ran against a byte-identical temporary copy, so no database engine ever opened the operational file.

| Property | Value |
| --- | --- |
| SHA-256 | `258658519428319b4a2d77316f0471e5aec9fcb0e56ad2d75a8edd3b7c50768b` |
| Size · mtime | 139,264 bytes · 2026-08-05 16:24:37 -0500 |
| `integrity_check` | **ok** |
| Journal mode | wal (header bytes 18/19 = `02 02`) |
| Page size · count · freelist | 4096 · 34 · **0** |
| Schema cookie · user_version · encoding | 4 · 0 · UTF-8 |
| File change counter · version-valid-for | 4 · 4 (consistent; no hot journal) |
| SQLite writer version | 3.53.2 (header bytes 96–99) |
| Events · entities | **135 · 39** |
| Sequences | min 1, max 135, distinct 135 → **zero gaps** |
| Duplicate event ids | **0** |
| `sqlite_sequence.events` | 135 |
| `-wal` / `-shm` sidecars | **absent** — last close was clean and checkpointed |

**No mutation indicator was found.** No gap, no duplicate, no schema drift, no corruption, no freelist churn, no hot journal, no count change. The mtime corresponds to the operator restarting Foundry for the Package 1b-ii-a observation, before Package 1b-iii began.

### Search for an artifact of the `8dd834d7` file

| Searched | Result |
| --- | --- |
| Committed tree, and `9534c21` | `8dd834d7` appears **only in `CHANGELOG.md` prose** |
| `git log --all --diff-filter=A -- '*.sqlite'` | **No `.sqlite` has ever been tracked** — deliberate, per Decision 4 of the V1.1 record and `.gitignore:56` |
| `apps/api/data/foundry.sqlite.pre-ac108-…` | 3 events / 2 entities — an August 3 state, not this file |
| `docs/evidence/fbl-028/`, `fbl-035/f12-verification/` | Different databases, unrelated to the operational ledger |
| Row-level manifest anywhere under `docs/evidence` | **None exists** |

No NAS path and no location outside the repository was searched.

---

## 3. What is and is not provable

**Provable:** the current file is uncorrupted, logically well-formed, cleanly closed, schema-unchanged, and holds 135 events at contiguous sequences 1–135 with no duplicates and 39 entities.

**Permanently unprovable:** that those 135 rows are the same rows the `8dd834d7` file held. Establishing it requires a row-level artifact of the former file, and **none was ever created**. Counts, contiguity, and integrity are *consistent with* equality and prove none of it — a substituted or edited ledger of the same shape would present identically.

The honest statement is **unverifiable**, not *unlikely*. The evidence contains nothing that would distinguish a physical-only rewrite from an undetected logical change, and no future work can recover the distinction.

---

## 4. The replacement gate — logical, not physical

Content-addressed over rows. No page layout, freelist, change counter, mtime, or writer version participates, so an ordinary open/close cannot move it.

```bash
# Operate on a copy; never open the live file with an engine.
cp apps/api/data/foundry.sqlite /tmp/audit.sqlite
C=/tmp/audit.sqlite
H() { printf "coalesce(hex(cast(%s as blob)),'~NULL~')" "$1"; }
EV="select $(H sequence)||'|'||$(H id)||'|'||$(H type)||'|'||$(H occurred_at)||'|'||$(H actor_type)||'|'||$(H actor_id)||'|'||$(H entity_type)||'|'||$(H entity_id)||'|'||$(H correlation_id)||'|'||$(H causation_id)||'|'||$(H severity)||'|'||$(H schema_version)||'|'||$(H payload) from events order by sequence asc;"
EN="select $(H entity_type)||'|'||$(H entity_id)||'|'||$(H data)||'|'||$(H updated_at) from entities order by entity_type asc, entity_id asc;"
SC="select type||'|'||name||'|'||coalesce(sql,'~NULL~') from sqlite_master where name not like 'sqlite_auto%' order by type asc, name asc;"
{ echo "FOUNDRY-LOGICAL-MANIFEST-v1"; sqlite3 "$C" "$SC"
  echo "ENCODING|$(sqlite3 "$C" 'PRAGMA encoding;')"
  echo "USER_VERSION|$(sqlite3 "$C" 'PRAGMA user_version;')"
  echo "SCHEMA_COOKIE|$(sqlite3 "$C" 'PRAGMA schema_version;')"
  echo "EVENTS"; sqlite3 "$C" "$EV"
  echo "ENTITIES"; sqlite3 "$C" "$EN"; } | shasum -a 256
```

**Design rationale.** Every field is hex-encoded, so no value can contain a separator, newline, or encoding-dependent character. `~NULL~` distinguishes NULL from empty string. Events order by `sequence`, entities by `(entity_type, entity_id)`, schema by `(type, name)` — all total and deterministic. Schema DDL, encoding, and cookie are included because rows cannot be interpreted without them. Autoindexes are excluded as engine artifacts.

**The row data itself is deliberately not committed.** Decision 4 of the V1.1 decision record keeps mutable runtime databases out of the repository; a full hex dump of the same rows would circumvent that decision by another route. What is recorded is the **method and the digest**, which is what a gate needs.

### Digests

| Manifest | Digest | Status |
| --- | --- | --- |
| `FOUNDRY-LOGICAL-MANIFEST-v1` (method above) | `0a6c4d348c8da88c45191593b2e02eac4cab05745a6369e46098677a78464f92` | **Reproduced twice, identically, during this audit** |
| `FOUNDRY-LOGICAL-MANIFEST-v2` | `768293606db3b3a08e7fd2d3e3ea44fad88d12c69e5866fd86f030201ab97862` | **Operator-designated. Method not recorded; not independently reproduced — see § 5** |

---

## 5. Open — the v2 method is not on record

The operator designated **`FOUNDRY-LOGICAL-MANIFEST-v2` digest `768293606db3b3a08e7fd2d3e3ea44fad88d12c69e5866fd86f030201ab97862`** as the authoritative baseline. **That digest could not be reproduced during this audit**, and the v2 generation method appears nowhere in the repository.

Six candidate reconstructions were computed against the same byte-identical copy and none matched: v1 body under a v2 header; rows only without header or schema; events only; v2 header plus rows only; `sqlite3 .dump`; and a plain `SELECT * FROM events`.

**A baseline nobody can regenerate is not a gate.** It is a number that reads authoritative with nothing behind it — precisely the failure this record is correcting, one layer up. The digest is recorded here as the operator designated it, and it is **marked not-yet-reproducible** rather than presented as verified.

**Obligation.** Before `768293…` is used to gate any package, the **v2 method must be recorded here** in the reproducible form § 4 uses, and the digest regenerated from the live ledger to confirm it. Until then, `0a6c4d34…` is the only digest in this record with a method behind it.

This is not a challenge to the ruling. Option A, the permanent unverifiability of `8dd834d7`, the absence of any mutation indicator, and the retirement of raw file hashes are all recorded as decided and none of them depends on which logical digest is authoritative.
