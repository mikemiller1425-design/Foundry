# Foundry — Package 2 Decision Record

**Type:** Append-only decision record
**Date:** 2026-08-06
**Decided by:** mikemiller1425-design (human operator)
**Recorded starting point:** `5329f775b7911e7a9512a3adc9405a4495b8c72c` (Package 1 closed)
**Companion records:** `foundry-package-1b-decision-record-2026-08-05.md` (not edited by this record) · `docs/03-architecture/nas-readonly-boundary-threat-model.md` · `docs/03-architecture/foundry-construction-map.md`

**Governance only.** This record makes decisions. It implements nothing, authorizes
no scan, and touches no source file. **Package 2 remains unimplemented, and
Package 2a requires its own explicit authorization before any code is written.**

**No NAS volume has been accessed.** Preparing this record involved no `stat`,
no traversal, and no access of any kind to any `/Volumes` path.

---

# 1. Operator decisions D-1 – D-7

## D-1 — The exact authorized root

> **`/Volumes/01_PRIVATE_VAULT/Voss`**

Only this exact root and its descendants are ever eligible.

**Explicitly excluded:** `/Volumes/01_PRIVATE_VAULT` outside the `Voss` subtree ·
`/Volumes/02_FAMILY_VAULT` · `/Volumes/05_BACKUPS` · `/Volumes/10_CORE` ·
`/Volumes/50_MEDIA` · `/Volumes/Synology_Photos_Shared` · recycle-bin and
snapshot directories · symlink targets resolving outside the authorized root ·
**every other mounted or subsequently mounted volume.**

If the root does not exist exactly, resolves through a symlink, or is mounted
under a different name: **stop without scanning.** Do not substitute another
path and do not broaden the root.

> **Naming and mounting this root do not authorize scanning it.** Mounting a
> share creates no scan authorization. These are separate acts, and the gap
> between them is where the operator decides.

## D-2 — Hash strategy

Metadata-first inventory with **targeted, resumable SHA-256**.

> **Size and mtime may detect change. They never establish identity.**

## D-3 — Automatic hashing threshold

**256 MiB.** Files above it remain **inventoried** and carry an **explicit
content-hash status**.

They are **not** `skipped`, `unsupported`, `identical`, `verified`, or
`duplicate` merely because automatic content hashing was not performed. Absence
of a hash is a stated fact about the scan, never a claim about the file.

## D-4 — Coverage model

Four independent dimensions, per § 7.2 of the 2026-08-05 record:
**A.** source connection · **B.** interval progress · **C.** item disposition ·
**D.** uncertainty flag with a mandatory reason.

## D-5 — Command Center timing

The NAS remains **`not_connected`** in the Command Center until Package 2d
integration passes **and** the operator accepts the first coverage report.

## D-6 — Initial bounds

| Bound | Value |
| --- | --- |
| `maxEntriesPerBatch` | 50 000 |
| `maxDepth` | 24 |
| `traversalConcurrency` | 4 |
| `contentHashConcurrency` | 1 |

> **The entry bound is a resumable batch boundary — not a total-volume ceiling
> and not a completion claim.** A batch that ends at its boundary has not
> failed; a type that cannot tell that apart from a fault is not honest.

## D-7 — Proposal authority

The NAS proposal documents and images (`docs/proposals/nas-district-*`) may
inform **Package 2c styling and information architecture only**.

They **cannot** supply fields, operational truth, scope, authorization, or
acceptance evidence.

---

# 2. Frontend and transport rulings 1 – 12

1. **2b provides a versioned, schema-validated read snapshot.** Event transport
   is added **only for real persisted scanner events** — the `AC-107` discipline:
   an event nothing can emit is a claim the system does not honour.
2. **Scan progress and the opaque resume cursor survive refresh *and* process
   restart.**
3. **Package 2c contains no browser commands** to start, cancel, or resume scans.
4. **The first scan uses a separately governed operator mechanism.**
5. **Ordinary frontend surfaces show relative paths and an operator root label —
   never the absolute mount path.**
6. **Restricted or withheld counts are explicit states or null, never zero.**
7. **Package 2c is named "NAS Inventory Frontend."**
8. **Package 2c does not create a `nas_inventory` operational mission.**
9. **Canonical transport fixtures live with contracts; rendering fixtures live in
   `apps/agent-city` tests.**
10. **Package 2d's operator report must expose:** the authorized root identity ·
    scan interval · declared bounds · item dispositions · stop reason · resume
    state · uncertainty · hash policy · before/after zero-write proof.
11. **Package 2c adds no NAS geometry to `WorldCanvas`.**
12. **Any spatial NAS representation requires a later, separately authorized
    package.**

---

# 3. Ruling on Q-1 — root configuration

> **`CONFIGURED_NAS_ROOTS` must remain empty throughout Package 2a and Package 2b.**

Packages 2a and 2b must not populate an allowlist, embed the path in executable
source, accept it through an environment override, `stat` it, traverse it, or
otherwise access any `/Volumes` path.

The mechanism that activates the exact root is **deferred to a separately
authorized Package 2d preparation decision**. It must fail closed, match the
canonical root exactly, reject substitution or broadening, and reject an
out-of-root symlink resolution.

> **Do not copy the `AC-111` committed-path mechanism into 2a or 2b merely by
> analogy.** The Package 2d activation mechanism is judged separately, on its
> own terms. An analogy is not a review.

---

# 4. Ruling on Q-2 — the accepted Package 1a defect

**C-1 is recorded append-only as a found-and-to-be-corrected accepted-1a defect.
It is not corrected silently.**

## 4.1 The defect

`apps/api/src/nas/nasCatalogAdapter.ts` writes `hashStrategy: request.hashStrategy`
— the strategy **requested**, not the one **applied**. A file above
`maxFileSizeBytesToHash` falls back to a `sm:${size}:${mtime}` value regardless of
the requested strategy.

**A file over 256 MiB scanned with `sha256_full` therefore records
`hashStrategy: "sha256_full"` while its fingerprint is a size/mtime pair.** The
asset asserts a SHA-256 that was never computed.

This contradicts § 4 of the threat model — *"Every asset records the strategy
that produced its fingerprint"* — and hollows out threat **T-14**, whose
guarantee holds for the recorded *value* and fails for the recorded *label*.

## 4.2 Historical blast radius — inert, but not acceptable

The defect was **inert**: `CONFIGURED_NAS_ROOTS` shipped empty, every real scan
was refused, and **no operational NAS asset was ever produced**. Its historical
effect is limited to synthetic fixtures.

> **That limits its effect. It does not make a false contract assertion
> acceptable.**

This is the same failure class as the Package 1b-iv monetary defect — a field
asserting a fact the system does not hold — and the same class §§ 8, 12, 14, and
15 of the Package 1b record each corrected.

## 4.3 Standing

**Package 1a remains historically accepted.** It is not reopened and not
reverted. **Package 2a owns the explicit contract correction and its regression
proof.**

---

# 5. Discovered contradictions C-1 – C-13

Found while reconciling D-1 – D-7 and rulings 1 – 12 against the construction
map, Package 1 closure at `5329f77`, § 7.2, the Package 1a NAS catalog, and the
threat model.

| # | Contradiction | Owner |
| --- | --- | --- |
| **C-1** | `hashStrategy` records the requested strategy, not the applied one — an asset can assert an uncomputed SHA-256 | 2a |
| **C-2** | `contentFingerprint: null` conflates "strategy was `none`" with "hashing was refused" | 2a |
| **C-3** | Hash strength is carried by an `sm:` string prefix, not a typed status; equality comparison silently treats size/mtime matches as identity | 2a |
| **C-4** | `NasDisposition` has five terms; § 7.2 dimension C requires six — `skipped` and `unsupported` are collapsed, and refusal grounds are folded into the disposition | 2a |
| **C-5** | `NasCoverageReport` is single-dimension; D-4 and § 7.2 require four. Two completeness functions coexist (`isCoverageComplete`, `isSourceCoverageComplete`) | 2a |
| **C-6** | Coverage counts are non-nullable, so a restricted or withheld count cannot be represented and would read as zero — prohibited by ruling 6 | 2a |
| **C-7** | Bounds names and semantics diverge from D-6; `contentHashConcurrency` does not exist | 2a |
| **C-8** | A `max_entries` stop currently reads as an incomplete-because-broken scan; under D-6 it is a normal resumable batch boundary | 2a |
| **C-9** | `resumeCursor` is returned but never persisted; ruling 2 requires survival across process restart | 2b |
| **C-10** | The construction map's Package 2 row lists five dispositions, omitting `unsupported` | corrected by this commit |
| **C-11** | Threat model § 4 treats `size_mtime` as a fingerprint default; D-2 demotes it to a change detector that never establishes identity | corrected by this commit |
| **C-12** | The proposal package offers an 89-event vocabulary with a 51-name first slice; ruling 1 and D-7 admit only events a real scanner emits | 2a / 2c |
| **C-13** | Whether a root that is *itself* a symlink is refused is not established by the existing code | 2a (fixtures) · 2d (real root) |

---

# 6. Package 2 decomposition

Each subpackage requires its **own explicit authorization**. None may begin
before its predecessor is accepted.

| Slot | Owner | Scope | Volume access |
| --- | --- | --- | --- |
| **2a** | **Claude** | Contract and scanner truth — correct C-1 – C-8, C-12, C-13 against fixtures | **None.** Fixtures only |
| **2b** | Codex | **Durable scan-state persistence *plus* schema-validated read transport** | **None.** Fixtures only |
| **2c** | Cursor | **NAS Inventory Frontend** | **None.** Fixtures only |
| **2d** | Claude + operator | Integration verification · separately governed root activation · first bounded scan · zero-write proof · operator-reviewed coverage report | **The only slot that may touch the named root** |

## 6.1 Why 2b's label changed

The scope is **durable scan-state persistence plus read transport**, not
"read transport." Ruling 2 requires the resume cursor to survive process
restart, which requires persistence — and **persistence cannot be smuggled in
under a transport-only label.** A package whose name understates what it touches
is a package whose review misses something.

## 6.2 2a's proof boundary — stated so it cannot be overclaimed

- 2a proves the root and symlink rules **only against controlled temporary
  fixtures**.
- **2a must not claim it verified the mounted `Voss` root.**
- **Exact canonical-path and root-symlink verification against the real root
  belongs to 2d, immediately before the authorized scan** — not earlier, and not
  by inference from a fixture that behaved correctly.

---

# 7. Dimension C — the six terms

Superseding the construction map's earlier five-term wording:

```
scanned
skipped
refused
inaccessible
unsupported
not_yet_scanned
```

**Refusal grounds are carried separately from the disposition.** Collapsing the
reason into the term is what made `refused_unsafe` and `skipped_unsupported`
encode two facts in one field.

---

# 8. Content-hash result — the required shape

> **Size/mtime is a change detector, never identity. It must not occupy an
> identity fingerprint field.**

Package 2a's contract must use a typed content-hash result equivalent to:

| Status | Carries |
| --- | --- |
| `hashed` | its **actual** algorithm and digest |
| `not_attempted_over_threshold` | the size and the threshold |
| `not_attempted_policy` | an honest reason |
| `attempt_failed` | an honest reason |

A completed digest carries the algorithm actually used. **Failure and policy
statuses require honest reasons** — an unexplained absence is not auditable.

**This shape is decided, not implemented.** No code in the repository satisfies
it at the time of this record.

---

# 9. Standing constraints

- **`CONFIGURED_NAS_ROOTS` remains empty through 2a and 2b.**
- **Mounting a share creates no scan authorization.**
- **Package 2 remains unimplemented until 2a receives its own explicit
  authorization.**
- Package 1 remains closed at `5329f77`; that closure advanced no `AC-*` rung.
- `AC-103` remains not started and still precedes `AC-111`; `AC-111` remains
  open; `AC-112` remains not started.
- The Command Center coverage state for the NAS is unchanged and stays
  `not_connected` until D-5 is satisfied.
