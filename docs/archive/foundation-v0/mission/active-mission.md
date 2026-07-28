# Active Mission — Agent City V1

**Mission status:** Active  
**Baseline:** 1.0-draft  
**Primary user:** One human operator  
**Primary display:** 49-inch ultrawide, with support for standard desktop

## 1. Objective

Build a fully functional, game-style operational neighborhood that allows one human operator to supervise one AI-assisted software build from objective through planning, implementation, validation, approval, transfer, and completion.

The application must prove that a spatial world can represent real workflow state more clearly and intuitively than a collection of disconnected terminals and dashboards.

## 2. Product hypothesis

A persistent world containing residents, homes, workplaces, cargo, vehicles, gates, and a Lighthouse can make agent activity, prerequisites, blocked work, approvals, failures, and capability progression understandable within ten seconds while preserving exact controls and evidence in conventional interface panels.

## 3. V1 world scope

V1 includes exactly:

- one Lighthouse;
- three persistent agent residents;
- three residential homes;
- one Construction Office;
- one Warehouse;
- one QA Building;
- one Deployment Dock;
- one Construction Site or active build representation;
- one small road network;
- one utility vehicle;
- one cargo package type;
- one approval gate;
- one capability-based Warehouse upgrade;
- one complete software-build workflow.

## 4. V1 agents

### Architect

Converts an operator objective into stages, requirements, acceptance criteria, dependencies, and risks.

### Builder

Implements the software inside a controlled project repository, initially through deterministic simulation and later through one Claude Code runtime adapter.

### Inspector

Validates requirements, tests outputs, rejects incomplete work, and creates evidence-backed approval packages.

## 5. Primary workflow

The demonstration objective is:

> Build a basic task-management web application supporting task creation, completion, deletion, loading states, error states, persistence, and tests.

The workflow stages are:

1. Objective intake
2. Architecture and requirements
3. Project scaffold
4. Frontend implementation
5. Backend implementation
6. Integration
7. Validation and QA
8. Human approval
9. Deployment package completion

The frontend must first run this workflow through a deterministic mock event engine. After the complete simulated loop is stable, one controlled implementation stage must be executed through Claude Code.

## 6. Required interactive capabilities

The operator can:

- start, pause, resume, reset, and replay the demonstration build;
- click and inspect every building;
- click and inspect every resident;
- view the active build, stages, requirements, artifacts, approvals, and event history;
- see why a transfer is blocked;
- approve, reject, or request revision at the approval gate;
- safely pause or resume an agent;
- inspect raw evidence and logs;
- authorize the Warehouse Level 2 upgrade after measured prerequisites pass;
- reload the browser without losing persisted demonstration state.

## 7. Frontend strategy

The frontend is built first using production components and realistic contracts, powered initially by a deterministic mock engine.

The frontend contains:

- a full-screen ultrawide shell;
- a dominant 3D world viewport;
- a left project/world navigator;
- a right live-intelligence panel;
- a bottom event timeline;
- a persistent command bar;
- building and agent detail panels;
- approval and evidence views;
- responsive collapse behavior for standard desktop.

## 8. Backend strategy

The first backend is thin but real. It owns state transitions, persistence, prerequisites, approvals, events, and mock execution.

After interface validation, a Claude Code runtime adapter replaces one simulated build stage.

## 9. Included technical scope

- Next.js and TypeScript frontend
- React Three Fiber / Three.js world renderer
- Tailwind CSS and accessible React UI components
- shared TypeScript contracts
- deterministic mock event engine
- persistent local development database
- API routes or a small backend service
- realtime event delivery through Server-Sent Events or WebSockets
- unit, integration, and end-to-end tests
- one Claude Code runtime adapter for a controlled repository stage

## 10. Explicit exclusions

The following may be documented but must not be implemented in V1:

- full city or multiple districts;
- Academy, schools, universities, internships, or agent curricula;
- company campuses or multi-company tenancy;
- Opportunity Center, market intelligence, or autonomous business discovery;
- agent hiring marketplace;
- simulated money economy;
- autonomous purchasing, contracts, taxes, or legal actions;
- social publishing, emails, job applications, or external customer messaging;
- destructive filesystem operations;
- production infrastructure changes;
- multiplayer;
- decorative citizens or traffic simulation;
- weather, seasons, day/night cycle, or large ambient systems;
- building interiors;
- character customization;
- complex technology trees;
- OpenClaw integration;
- multiple AI providers;
- mobile-first world editing.

## 11. Success criteria

V1 succeeds when:

1. the complete workflow can run from start to completion;
2. one requirement intentionally fails and blocks cargo movement;
3. the exact missing requirement is inspectable;
4. the Builder retries and Inspector validates the repaired stage;
5. the vehicle moves only after the backend declares the transfer ready;
6. the Lighthouse visibly requests approval;
7. approval resumes the workflow;
8. final delivery completes;
9. the Warehouse becomes upgrade eligible from real metrics;
10. the upgrade changes both visual level and backend capability state;
11. event history and world state survive a page reload;
12. the operator can understand the system within ten seconds.

## 12. Current development stage

**Stage 0 — Specification audit.**

No application code may be written until Claude Code audits the governing documents and identified contradictions are resolved.

## 13. Stop condition

V1 is complete only when every mandatory acceptance test in `specifications/004-v1-acceptance.md` passes.

No excluded feature may be added as a substitute for a failing required feature.
