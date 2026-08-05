# Package 1b — Pre-reconciliation frontend baseline

**Type:** Evidence record
**Date:** 2026-08-05
**Baseline artifact:** `docs/evidence/package-1b/frontend-baseline-manifest-2026-08-05.tsv`
**Authoritative digest:** `776d0653ffcfc86415961a94f47e80917662a3a14ba14d9978feb11d6c651b80`
**Supersedes as baseline:** `e6bedfcc4814b1dd16d9521414c8463c1845762b988789543b8b6121e5f213bb`
**Correction recorded at:** § 8 of `docs/01-mission/foundry-package-1b-decision-record-2026-08-05.md`
**Repository state:** base frontend checkpoint `7d7fff6`; records at `ee924fa`

---

## 1. What this is

The complete, portable fingerprint of the **uncommitted frontend that the authorized Package 1b-i reconciliation will act on** — 83 files under `apps/agent-city`, captured before any reconciliation work begins.

It replaces an earlier digest that covered only 82 of those 83 files. The omission and its cause are recorded in § 8 of the decision record; this document is the evidence the correction points to.

---

## 2. Exact portable generation command

Run from any checkout at the same repository state. Output is byte-identical across machines: no mtimes, no sizes, no modes, no locale-dependent ordering.

```bash
cd "$(git rev-parse --show-toplevel)"
{
  git diff --name-only --diff-filter=M -- apps/agent-city | while read -r p; do
    printf 'tracked-modified\t%s\t%s\n' "$(shasum -a 256 "$p" | cut -d' ' -f1)" "$p"
  done
  git ls-files --others --exclude-standard -- apps/agent-city | while read -r p; do
    printf 'untracked-new\t%s\t%s\n' "$(shasum -a 256 "$p" | cut -d' ' -f1)" "$p"
  done
} | LC_ALL=C sort -t"$(printf '\t')" -k3,3 > frontend-manifest.tsv
shasum -a 256 < frontend-manifest.tsv
```

**Expected:** `776d0653ffcfc86415961a94f47e80917662a3a14ba14d9978feb11d6c651b80`

### Format

One line per file, three TAB-separated fields, newline-terminated:

```
<status>\t<sha256-of-file-contents>\t<repository-relative-path>
```

`<status>` is `tracked-modified` or `untracked-new`. Lines are sorted **by path**, lexically, under `LC_ALL=C`.

### Why this form

Each property fixes a specific way the earlier method could vary between machines or runs:

| Property | Prevents |
| --- | --- |
| `git diff` / `git ls-files --others` classify | `awk`-parsed porcelain codes, which break on renames and on paths containing spaces |
| `ls-files --others` emits **files** | Untracked-directory entries expanding differently depending on whether `-u` was passed |
| `LC_ALL=C` | Locale-dependent collation changing line order, and therefore the digest |
| Sorted **by path**, not by hash | Ordering shifting when a file's content changes |
| Explicit status field | Losing the tracked/untracked distinction, as the earlier method did |
| Content SHA-256 only | mtimes, sizes, and modes leaking machine state into the digest |
| TAB separator | Ambiguity against `shasum`'s two-space format |

---

## 3. Validation performed 2026-08-05

Regenerated independently from the working tree and compared before persisting.

| Check | Required | Observed |
| --- | --- | --- |
| Lines | 83 | **83** |
| Unique repository-relative paths | 83 | **83**, 0 duplicates |
| `tracked-modified` | 38 | **38** |
| `untracked-new` | 45 | **45** |
| Fields per line | 3 | **3** on every line |
| Directory placeholders | none | **none** — every path is a file |
| `RuntimeProvider.tsx` path well-formed | exact | `apps/agent-city/src/lib/mock-runtime/RuntimeProvider.tsx` |
| Path ordering | lexical, `LC_ALL=C` | **verified** — re-sorting is a no-op |
| Final digest | `776d0653…` | **`776d0653…`** |
| Independent regeneration | identical | **byte-identical** |

---

## 4. The file the earlier digest omitted

```
tracked-modified	63aef79c2887901a0e038d1acb4306894758338b069f0c332d90809f2d68fb3e	apps/agent-city/src/lib/mock-runtime/RuntimeProvider.tsx
```

This file was **partially** staged at `7d7fff6` — four of eight hunks committed, four left in the working tree. It was therefore still dirty after the commit, but the earlier derivation subtracted every staged path unconditionally and dropped it.

Its four retained hunks are the fixture-journey and `runtimeSource` work held back under Decision C-2. They are intact: `fixtureJourneys` ×2, `fixtureReplay` ×2, `"Mission trace"` ×1.

---

## 5. Standing

This manifest is the **pre-reconciliation baseline**. The authorized Package 1b-i reconciliation must reproduce `776d0653…` before making any edit; a mismatch means the tree is not the tree that was audited, and the reconciliation stops.

It is a **baseline, not an approval.** Nothing here authorizes the reconciliation, and the manifest asserts nothing about whether the 83 files should be accepted, amended, or rejected — that is Decision C-2 and the reconciliation's own report.
