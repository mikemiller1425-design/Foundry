# NAS Read-Only Boundary — Architecture and Threat Model

**Type:** Architecture and threat-model note
**Date:** 2026-08-04
**Scope:** Construction Package 1a — contracts and adapter boundary only. **No NAS has been accessed.**

---

## 1. The governing decision

**The Synology NAS is authoritative storage. Foundry indexes it and never changes it.**

That is the operator's decision, not an engineering default, and it shapes every type here. The unsafe operation is made *unrepresentable* rather than discouraged: there is no write command, no destination path, no extraction target, and no rename or delete anywhere in the contract surface. A future mutation capability would require its own contract, its own command, and its own authorization — it cannot be reached by passing a different argument to something that already exists.

## 2. Architecture

```
  operator config ──► NasRoot registry (named roots, EMPTY in 1a)
                            │  select by rootId — never a path
                            ▼
  NasScanRequest ──► scanNasRoot() ──► NasScanResult
                            │           ├─ NasAsset[]      (metadata only)
                            │           ├─ NasCoverageReport (honest)
                            │           ├─ readOnly: true
                            │           └─ archivesExtracted: false
                            ▼
                     five read syscalls only:
                     opendir · lstat · stat · readlink · realpath
                     (+ a read stream, only when hashing is requested)
```

**Roots are named, not passed.** A caller supplies a `rootId` that must match committed configuration. With a path parameter, "scan the NAS" and "traverse anywhere this process can read" would be the same operation, distinguished only by the caller's intentions.

**The registry ships empty**, so every scan of a real root refuses until the Package 2 gate. An empty registry *is* the gate — a default pointing at a plausible mount would mean the first accidental call scanned the operator's storage.

## 3. Threat model

| # | Threat | Disposition | Mechanism |
| --- | --- | --- | --- |
| T-1 | **Caller traverses outside the NAS** by supplying a path | Unrepresentable | No path field. `rootId` must match configuration |
| T-2 | **Symlink escape** — a link inside the NAS points at `~/.ssh` | **Refused and recorded** | Every entry `realpath`-canonicalized and checked against the canonical root *before* being touched. Refusal names the target |
| T-3 | **Path traversal** via `../` in a filename | Refused | Same canonicalize-then-contain check; the resolved path decides, not the string |
| T-4 | **Directory cycle** exhausts the process | Cut and recorded | Visited real paths tracked; a repeat is refused as a cycle |
| T-5 | **Archive bomb** — a 10 KB zip expanding to 10 GB | **Inert** | Nothing decompresses. A `.zip` is classified, counted, `sealedArchive: true`, and left shut. There is nothing to expand |
| T-6 | **Accidental mutation** — a rename or delete slips in | Structurally prevented | No write primitive is imported. A test asserts this over the module's import list |
| T-7 | **In-place extraction** | Unrepresentable | No extraction library, no extraction target field |
| T-8 | **Unbounded walk** on a multi-TB volume | Bounded | `maxEntries`, `maxDepth`, `concurrency` caps; cancellation; a resume cursor |
| T-9 | **Silent coverage loss** — files dropped, scan reads as complete | **Prevented** | Every entry gets one of five dispositions; each refusal recorded individually; `complete` is *computed*, and false whenever anything was refused, inaccessible, left over, **or the walk did not run to the end** |
| T-10 | **Permission-denied treated as absence** | Recorded as `inaccessible` | Coverage marked incomplete; the specific error retained |
| T-11 | **Malformed entry** — socket, device, FIFO | Classified, not interpreted | Counted as `skipped_unsupported` with a reason |
| T-12 | **Unavailable volume** | Reported, not thrown | `stoppedReason: "root_unavailable"`, coverage incomplete |
| T-13 | **Path disclosure** in a shared UI | Mitigated | `relativePath` for display; `sourcePath` retained as evidence and marked not-for-display. A directory tree discloses more than the file it names |
| T-14 | **Hashing a 40 GB video every pass** | Bounded; **honesty partially defeated — see § 7** | Above `maxFileSizeBytesToHash`, a weaker `size_mtime` fingerprint is recorded **as** `sm:` — never a sha256 that was not computed. **The recorded *value* honours this. The recorded `hashStrategy` *label* does not** (defect C-1, § 7) |
| T-15 | **Reading file contents unintentionally** | Bounded | Contents are read only when a sha256 strategy is chosen, and `sha256_head` reads a bounded prefix. `none` and `size_mtime` open nothing |

### Threats explicitly **not** addressed

- **A compromised process.** This boundary constrains *this adapter*. It does not sandbox the Node process, which retains whatever filesystem access the OS grants it. That would need OS-level confinement, which V1.1 does not implement — the same honest limitation the runtime boundary records.
- **A hostile NAS.** A NAS actively serving different content per read is out of scope.
- **Race conditions.** A file changing between `realpath` and `stat` yields a recorded inaccessibility, not a guarantee of atomicity.

## 4. Hash strategy — the operational tradeoff

| Strategy | Cost | Detects | Misses |
| --- | --- | --- | --- |
| `none` | zero I/O | nothing | everything; identity is path-based |
| `size_mtime` | one `stat` | most edits | same-size edits preserving mtime; deliberate tampering |
| `sha256_head` | first 64 KB | header/format changes, most truncations | edits past the prefix |
| `sha256_full` | whole file | any content change | nothing — but reads every byte |

**Default: `size_mtime`.** A multi-terabyte volume of video cannot be fully hashed on every pass, and a scan nobody finishes is worse than a weaker fingerprint honestly labelled. `sha256_full` is chosen per-scan for material that later analysis actually needs deduplicated.

Every asset records the strategy that produced its fingerprint, so a later reader knows what it is worth rather than assuming the strongest.

> ### ⚠ Superseded 2026-08-06 — § 4 above is preserved as written and is no longer the governing statement
>
> **The last sentence was not true of the shipped code.** See § 7 below: the adapter records the strategy that was *requested*, not the one that was *applied*. The claim is preserved rather than edited, because a threat model that quietly repairs its own text cannot be audited against what it once asserted.
>
> **Operator ruling D-2 (2026-08-06):** *size and mtime may detect change but never establish identity.* `size_mtime` is therefore a **change detector**, not a fingerprint, and it must not occupy an identity fingerprint field. The table above is retained for its cost/detection tradeoffs; its framing of `size_mtime` as a fingerprint default is superseded.
>
> **Operator ruling D-3:** files above the **256 MiB** threshold remain inventoried and carry an **explicit content-hash status**. They are never `skipped`, `unsupported`, `identical`, `verified`, or `duplicate` merely because automatic hashing was not performed.
>
> Package 2a must adopt a typed content-hash result equivalent to `hashed` (carrying its **actual** algorithm and digest) · `not_attempted_over_threshold` · `not_attempted_policy` · `attempt_failed`, the latter two with honest reasons. **This is decided, not implemented.**
>
> Recorded at `docs/01-mission/foundry-package-2-decision-record-2026-08-06.md` §§ 4, 8.

## 5. Verification performed

23 offline tests, synthetic fixture trees in temporary directories. **No NAS path was accessed.**

Proven: the registry is empty and refuses every id · a scan request cannot carry a path · no write primitive is imported · the fixture tree is byte-identical after a scan · symlink escape refused (file and directory) · directory cycle cut · dangling symlink recorded as inaccessible · a ZIP classified without extraction and byte-identical afterwards · a 10 MB "bomb" inert · unsupported files counted not dropped · unreadable directory recorded and coverage incomplete · unavailable root reported not thrown · entry bound stops with a resume cursor · cancellation honoured · all six material types classified · stable asset ids across scans · relative vs source path separation · hash strategies including the large-file fallback.

**One defect found by these tests:** `complete` was computed from counters alone, so a scan cancelled before examining anything reported **complete coverage**. The stop reason is now part of the computation. That is exactly the dishonesty the type exists to prevent, and it took a test to catch it.

## 6. What Package 2 must add

A configured root, chosen by the operator · a decision on hash strategy per material type · persistence of the catalog · a coverage surface the operator can read · **proof, by comparing the tree before and after a real scan, that nothing changed.**

---

## 7. Defect C-1 — recorded 2026-08-06, not yet corrected

**Append-only. Nothing above this line is rewritten.**

`apps/api/src/nas/nasCatalogAdapter.ts` writes `hashStrategy: request.hashStrategy`
— the strategy **requested**, not the one **applied**. A file above
`maxFileSizeBytesToHash` falls back to a `sm:${size}:${mtime}` value regardless
of the strategy asked for.

> **A file over 256 MiB scanned with `sha256_full` records
> `hashStrategy: "sha256_full"` while its fingerprint is a size/mtime pair.**
> The asset asserts a SHA-256 that was never computed.

This contradicts § 4's claim that *"every asset records the strategy that
produced its fingerprint"*, and it hollows out **T-14**: the guarantee holds for
the recorded *value* and fails for the recorded *label*. `contentFingerprint`
compounds it — its `null` means *both* "strategy was `none`" *and* "hashing was
refused", two facts with different remedies.

**Historical blast radius — inert.** `CONFIGURED_NAS_ROOTS` shipped empty, every
real scan was refused, and **no operational NAS asset was ever produced**. The
effect is confined to synthetic fixtures.

**That limits the effect. It does not make a false contract assertion
acceptable.** It is the same failure class as the Package 1b-iv monetary defect
— a field asserting a fact the system does not hold.

**Standing.** Package 1a remains historically accepted; it is not reopened and
not reverted. **Package 2a owns the explicit contract correction and its
regression proof.** The defect is live in `main` at the time of this record.

**Operator ruling Q-2 (2026-08-06):** record append-only; do not correct
silently. See `docs/01-mission/foundry-package-2-decision-record-2026-08-06.md` § 4.

---

## 8. What Package 2 must add — revised 2026-08-06

§ 6 above is preserved as written. It is superseded on its detail by the
Package 2 decision record, which decomposes the work into **2a** (contract and
scanner truth, fixtures only, owner Claude) · **2b** (durable scan-state
persistence **plus** schema-validated read transport, fixtures only) · **2c**
(NAS Inventory Frontend, fixtures only) · **2d** (integration verification,
separately governed root activation, first bounded scan, zero-write proof, and
the operator-reviewed coverage report — **the only slot that may touch the
named root**).

**`CONFIGURED_NAS_ROOTS` remains empty through 2a and 2b.** The authorized
future root is `/Volumes/01_PRIVATE_VAULT/Voss`; naming and mounting it
authorize nothing. The activation mechanism is deferred to a separately
authorized 2d preparation decision and is **not** inherited from `AC-111` by
analogy.

**Proof boundary.** 2a proves the root and symlink rules **only against
controlled temporary fixtures** and **must not claim it verified the mounted
`Voss` root**. Exact canonical-path and root-symlink verification against the
real root belongs to **2d, immediately before the authorized scan**.
