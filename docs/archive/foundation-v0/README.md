# Agent City V1 Documentation Package

**Specification baseline:** Draft 1.0  
**Primary target:** 49-inch ultrawide display  
**Implementation strategy:** Frontend-first, contract-first, vertical slices  
**Primary builder:** Claude Code  
**Primary inspection environment:** Cursor

## Purpose

This repository defines the product, domain language, visual world, event model, safety rules, acceptance criteria, future concepts, and architectural decisions for Agent City V1 before application code is written.

Agent City is a spatial operations interface. The world does not simulate work for entertainment; it renders real operational state so a human can understand, inspect, approve, and govern autonomous software workflows.

## Reading order

1. `constitution/constitution.md`
2. `mission/active-mission.md`
3. `specifications/001-world-bible.md`
4. `specifications/002-entity-model.md`
5. `specifications/003-event-dictionary.md`
6. `specifications/004-v1-acceptance.md`
7. `architecture-decisions/`
8. `future/`

## Current implementation boundary

Only the current mission may be implemented. Future Registry documents preserve valid expansion ideas but do not authorize implementation.

## Required first Claude Code action

Claude Code must audit the documents before writing application code. Use `CLAUDE-HANDOFF-001-SPEC-AUDIT.md`.
