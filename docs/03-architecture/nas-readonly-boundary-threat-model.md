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
| T-14 | **Hashing a 40 GB video every pass** | Bounded, and honest | Above `maxFileSizeBytesToHash`, a weaker `size_mtime` fingerprint is recorded **as** `sm:` — never a sha256 that was not computed |
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

## 5. Verification performed

23 offline tests, synthetic fixture trees in temporary directories. **No NAS path was accessed.**

Proven: the registry is empty and refuses every id · a scan request cannot carry a path · no write primitive is imported · the fixture tree is byte-identical after a scan · symlink escape refused (file and directory) · directory cycle cut · dangling symlink recorded as inaccessible · a ZIP classified without extraction and byte-identical afterwards · a 10 MB "bomb" inert · unsupported files counted not dropped · unreadable directory recorded and coverage incomplete · unavailable root reported not thrown · entry bound stops with a resume cursor · cancellation honoured · all six material types classified · stable asset ids across scans · relative vs source path separation · hash strategies including the large-file fallback.

**One defect found by these tests:** `complete` was computed from counters alone, so a scan cancelled before examining anything reported **complete coverage**. The stop reason is now part of the computation. That is exactly the dishonesty the type exists to prevent, and it took a test to catch it.

## 6. What Package 2 must add

A configured root, chosen by the operator · a decision on hash strategy per material type · persistence of the catalog · a coverage surface the operator can read · **proof, by comparing the tree before and after a real scan, that nothing changed.**
